// Local read-only game launcher. Uses C# 3-era language constructs; the Windows launcher still requires platform validation.
// No proxy, no outgoing network call, no installation, no public-network listener.
using System;
using System.IO;
using System.IO.Compression;
using System.Globalization;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;

public static class RailEmpireLocalServer {
    static string root;
    static string authority;
    static TcpListener listener;
    static volatile bool stopping;
    static int active;
    static readonly Dictionary<string,string> mime = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase) {
        {".html","text/html; charset=utf-8"},{".js","text/javascript; charset=utf-8"},{".css","text/css; charset=utf-8"},
        {".json","application/json; charset=utf-8"},{".txt","text/plain; charset=utf-8"},{".svg","image/svg+xml"},
        {".png","image/png"},{".jpg","image/jpeg"},{".jpeg","image/jpeg"},{".webp","image/webp"},{".gif","image/gif"},
        {".ico","image/x-icon"},{".wav","audio/wav"},{".mp3","audio/mpeg"},{".ogg","audio/ogg"},
        {".m4a","audio/mp4"},{".csv","text/csv; charset=utf-8"},{".wasm","application/wasm"},{".onnx","application/octet-stream"},{".bin","application/octet-stream"},
        {".woff","font/woff"},{".woff2","font/woff2"},{".ttf","font/ttf"},{".otf","font/otf"}
    };
    public static void Run(string folder, int port, bool openBrowser) {
        if (port < 1024 || port > 65535) throw new ArgumentException("Port invalide.");
        root = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!File.Exists(Path.Combine(root,"index.html"))) throw new FileNotFoundException("Extraire le ZIP complet avant de lancer le jeu.");
        authority = "127.0.0.1:" + port;
        listener = new TcpListener(IPAddress.Loopback,port);
        stopping = false;
        try { listener.Start(32); }
        catch (SocketException) { throw new InvalidOperationException("Port local " + port + " occupe. Fermer l'ancien lanceur ; aucun port aleatoire ne sera choisi (sauvegarde du navigateur)."); }
        Console.WriteLine("Rail Empire : http://" + authority + "/index.html");
        Console.WriteLine("Serveur local en lecture seule. Garder cette fenetre ouverte. Ctrl+C pour arreter.");
        Console.CancelKeyPress += StopOnCancel;
        if(openBrowser) { try { Process.Start("http://" + authority + "/index.html"); } catch { Console.WriteLine("Ouvrir l'adresse ci-dessus dans votre navigateur."); } }
        try {
            while (!stopping) {
                TcpClient client;
                try { client=listener.AcceptTcpClient(); } catch(SocketException) { if(stopping)break;throw; }
                if(Interlocked.Increment(ref active)>16) { Interlocked.Decrement(ref active);client.Close();continue; }
                ThreadPool.QueueUserWorkItem(Serve,client);
            }
        } finally { listener.Stop();Console.CancelKeyPress -= StopOnCancel; }
    }
    static void StopOnCancel(object sender, ConsoleCancelEventArgs e) { e.Cancel=true;stopping=true;listener.Stop(); }
    static void Header(NetworkStream stream, int status, string reason, long length, string type, string extra) {
        string text="HTTP/1.1 "+status+" "+reason+"\r\nConnection: close\r\n"+(length>=0?"Content-Length: "+length+"\r\n":"")+
            "Content-Type: "+type+"\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: strict-origin-when-cross-origin\r\n"+extra+"\r\n";
        byte[] bytes=Encoding.ASCII.GetBytes(text);stream.Write(bytes,0,bytes.Length);
    }
    static bool AcceptsGzip(string value) {
        double wildcard=0,explicitValue=-1;
        foreach(string item in value.ToLowerInvariant().Split(',')) {
            string[] parts=item.Trim().Split(';');double quality=1;
            for(int i=1;i<parts.Length;i++) { string parameter=parts[i].Trim();
                if(parameter.StartsWith("q=",StringComparison.Ordinal)) {
                    if(!Double.TryParse(parameter.Substring(2),NumberStyles.AllowDecimalPoint,CultureInfo.InvariantCulture,out quality)||quality<0||quality>1||Double.IsNaN(quality))quality=0;
                }
            }
            if(parts[0]=="gzip")explicitValue=quality;if(parts[0]=="*")wildcard=quality;
        }
        return (explicitValue>=0?explicitValue:wildcard)>0;
    }
    static void Error(NetworkStream stream, int status, string reason) { Header(stream,status,reason,0,"text/plain","Cache-Control: no-store\r\n"); }
    static void Serve(object state) {
        TcpClient client=(TcpClient)state;
        try {
            client.ReceiveTimeout=5000;client.SendTimeout=15000;
            using(NetworkStream stream=client.GetStream()) {
                byte[] buffer=new byte[16384];int n=0;
                while(n<buffer.Length) { int b=stream.ReadByte();if(b<0)return;buffer[n++]=(byte)b;if(n>=4&&buffer[n-4]==13&&buffer[n-3]==10&&buffer[n-2]==13&&buffer[n-1]==10)break; }
                if(n==buffer.Length) { Error(stream,431,"Request Header Fields Too Large");return; }
                string[] lines=Encoding.ASCII.GetString(buffer,0,n).Split(new string[]{"\r\n"},StringSplitOptions.None);
                string[] first=lines[0].Split(' ');
                if(first.Length!=3 || (first[2]!="HTTP/1.1"&&first[2]!="HTTP/1.0")) { Error(stream,400,"Bad Request");return; }
                bool head=first[0]=="HEAD";
                if(first[0]!="GET"&&!head) { Error(stream,405,"Method Not Allowed");return; }
                Dictionary<string,string> headers=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
                for(int i=1;i<lines.Length;i++) { int colon=lines[i].IndexOf(':');if(colon<1)continue;string k=lines[i].Substring(0,colon).Trim();if(headers.ContainsKey(k)){Error(stream,400,"Bad Request");return;}headers[k]=lines[i].Substring(colon+1).Trim(); }
                string host;
                if(!headers.TryGetValue("Host",out host)||!String.Equals(host,authority,StringComparison.OrdinalIgnoreCase)) { Error(stream,403,"Forbidden");return; }
                string origin;
                if(headers.TryGetValue("Origin",out origin)&&origin!="http://"+authority) { Error(stream,403,"Forbidden");return; }
                string requested=first[1].Split('?')[0];
                if(!requested.StartsWith("/",StringComparison.Ordinal)||requested.StartsWith("//",StringComparison.Ordinal)) { Error(stream,400,"Bad Request");return; }
                try { requested=Uri.UnescapeDataString(requested); } catch { Error(stream,400,"Bad Request");return; }
                if(requested.IndexOf('\\')>=0||requested.IndexOf(':')>=0||requested.IndexOf('\0')>=0||requested.IndexOf('%')>=0) { Error(stream,403,"Forbidden");return; }
                string[] parts=requested.Split('/');
                foreach(string part in parts) if(part==".."||part.StartsWith(".",StringComparison.Ordinal)) { Error(stream,403,"Forbidden");return; }
                if(requested=="/")requested="/index.html";
                bool allowed=requested=="/index.html"||requested=="/admin.html"||requested=="/style.css"||requested=="/VERSION.txt"||requested=="/AIDE_CARTE_OSM.html";
                foreach(string prefix in new string[]{"/js/","/data/","/img/","/audio/"})if(requested.StartsWith(prefix,StringComparison.Ordinal))allowed=true;
                if(!allowed||requested.IndexOf("/__tests__/",StringComparison.Ordinal)>=0) { Error(stream,403,"Forbidden");return; }
                string file=Path.GetFullPath(Path.Combine(root,requested.TrimStart('/').Replace('/',Path.DirectorySeparatorChar)));
                if(!file.StartsWith(root,StringComparison.OrdinalIgnoreCase)) { Error(stream,403,"Forbidden");return; }
                string extension=Path.GetExtension(file).ToLowerInvariant(),contentType;
                if(!mime.TryGetValue(extension,out contentType)) { Error(stream,403,"Forbidden");return; }
                bool packed=false;
                if(!File.Exists(file)&&(extension==".js"||extension==".json"||extension==".css"||extension==".csv"||extension==".svg")){file+=".gz";packed=true;}
                if(!File.Exists(file)){Error(stream,404,"Not Found");return;}
                string walk=file;
                while(walk.Length>=root.Length) { if((File.GetAttributes(walk)&FileAttributes.ReparsePoint)!=0){Error(stream,403,"Forbidden");return;}walk=Path.GetDirectoryName(walk);if(walk==null)break; }
                string accept;bool gzip=packed&&headers.TryGetValue("Accept-Encoding",out accept)&&AcceptsGzip(accept);
                FileInfo info=new FileInfo(file);string etag="\""+info.Length.ToString("x")+"-"+info.LastWriteTimeUtc.Ticks.ToString("x")+(packed?(gzip?"-g":"-i"):"")+"\"";
                string extra="ETag: "+etag+"\r\nCache-Control: private, max-age=0, must-revalidate\r\n";
                if(packed)extra+="Vary: Accept-Encoding\r\n";
                if(gzip)extra+="Content-Encoding: gzip\r\n";
                string tag;
                if(headers.TryGetValue("If-None-Match",out tag)&&tag==etag){Header(stream,304,"Not Modified",0,contentType,extra);return;}
                using(FileStream input=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite)) {
                    Header(stream,200,"OK",packed&&!gzip?-1:input.Length,contentType,extra);
                    if(!head){
                        Stream body=input;GZipStream decoded=null;
                        if(packed&&!gzip){decoded=new GZipStream(input,CompressionMode.Decompress);body=decoded;}
                        try{byte[] block=new byte[65536];int read;while((read=body.Read(block,0,block.Length))>0)stream.Write(block,0,read);}
                        finally{if(decoded!=null)decoded.Dispose();}
                    }
                }
            }
        } catch(IOException) { /* disconnected browser or timeout */ }
          catch(SocketException) { /* disconnected browser */ }
          catch(Exception e) { Console.Error.WriteLine("Requete locale refusee : "+e.GetType().Name); }
        finally { client.Close();Interlocked.Decrement(ref active); }
    }
}
