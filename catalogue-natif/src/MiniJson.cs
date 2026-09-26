// Rail Empire Catalogue — lecteur/écrivain JSON minimal sans dépendance externe
// (compatible .NET Framework 4.0 / Windows 7 32 bits).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace RailEmpireCatalogue
{
    public static class MiniJson
    {
        public static object Parse(string s)
        {
            int i = 0;
            SkipWs(s, ref i);
            object v = ParseValue(s, ref i);
            SkipWs(s, ref i);
            if (i != s.Length) throw new FormatException("JSON : caractères après la fin du document (position " + i + ")");
            return v;
        }

        static void SkipWs(string s, ref int i)
        {
            while (i < s.Length)
            {
                char c = s[i];
                if (c == ' ' || c == '\t' || c == '\r' || c == '\n') i++; else break;
            }
        }

        static object ParseValue(string s, ref int i)
        {
            if (i >= s.Length) throw new FormatException("JSON : fin inattendue");
            char c = s[i];
            switch (c)
            {
                case '{': return ParseObject(s, ref i);
                case '[': return ParseArray(s, ref i);
                case '"': return ParseString(s, ref i);
                case 't': Expect(s, ref i, "true"); return true;
                case 'f': Expect(s, ref i, "false"); return false;
                case 'n': Expect(s, ref i, "null"); return null;
                default: return ParseNumber(s, ref i);
            }
        }

        static void Expect(string s, ref int i, string word)
        {
            if (string.CompareOrdinal(s, i, word, 0, word.Length) != 0) throw new FormatException("JSON : littéral invalide (position " + i + ")");
            i += word.Length;
        }

        static Dictionary<string, object> ParseObject(string s, ref int i)
        {
            var d = new Dictionary<string, object>();
            i++; // {
            SkipWs(s, ref i);
            if (i < s.Length && s[i] == '}') { i++; return d; }
            while (true)
            {
                SkipWs(s, ref i);
                if (i >= s.Length || s[i] != '"') throw new FormatException("JSON : clé attendue (position " + i + ")");
                string key = ParseString(s, ref i);
                SkipWs(s, ref i);
                if (i >= s.Length || s[i] != ':') throw new FormatException("JSON : ':' attendu (position " + i + ")");
                i++;
                SkipWs(s, ref i);
                d[key] = ParseValue(s, ref i);
                SkipWs(s, ref i);
                if (i >= s.Length) throw new FormatException("JSON : objet non terminé");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == '}') { i++; return d; }
                throw new FormatException("JSON : ',' ou '}' attendu (position " + i + ")");
            }
        }

        static List<object> ParseArray(string s, ref int i)
        {
            var a = new List<object>();
            i++; // [
            SkipWs(s, ref i);
            if (i < s.Length && s[i] == ']') { i++; return a; }
            while (true)
            {
                SkipWs(s, ref i);
                a.Add(ParseValue(s, ref i));
                SkipWs(s, ref i);
                if (i >= s.Length) throw new FormatException("JSON : tableau non terminé");
                if (s[i] == ',') { i++; continue; }
                if (s[i] == ']') { i++; return a; }
                throw new FormatException("JSON : ',' ou ']' attendu (position " + i + ")");
            }
        }

        static string ParseString(string s, ref int i)
        {
            i++; // "
            int start = i;
            // Fast path: no escapes.
            while (i < s.Length && s[i] != '"' && s[i] != '\\') i++;
            if (i < s.Length && s[i] == '"') { string plain = s.Substring(start, i - start); i++; return plain; }
            var sb = new StringBuilder();
            sb.Append(s, start, i - start);
            while (i < s.Length)
            {
                char c = s[i++];
                if (c == '"') return sb.ToString();
                if (c != '\\') { sb.Append(c); continue; }
                if (i >= s.Length) break;
                char e = s[i++];
                switch (e)
                {
                    case '"': sb.Append('"'); break;
                    case '\\': sb.Append('\\'); break;
                    case '/': sb.Append('/'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw new FormatException("JSON : séquence \\u tronquée");
                        sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: throw new FormatException("JSON : échappement invalide \\" + e);
                }
            }
            throw new FormatException("JSON : chaîne non terminée");
        }

        static object ParseNumber(string s, ref int i)
        {
            int start = i;
            if (i < s.Length && (s[i] == '-' || s[i] == '+')) i++;
            while (i < s.Length)
            {
                char c = s[i];
                if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '-' || c == '+') i++; else break;
            }
            if (i == start) throw new FormatException("JSON : valeur invalide (position " + i + ")");
            string num = s.Substring(start, i - start);
            double d;
            if (!double.TryParse(num, NumberStyles.Float, CultureInfo.InvariantCulture, out d)) throw new FormatException("JSON : nombre invalide '" + num + "'");
            return d;
        }

        // ---------------------------------------------------------------- écriture
        public static string Serialize(object v)
        {
            var sb = new StringBuilder();
            Write(sb, v);
            return sb.ToString();
        }

        static void Write(StringBuilder sb, object v)
        {
            if (v == null) { sb.Append("null"); return; }
            if (v is string) { WriteString(sb, (string)v); return; }
            if (v is bool) { sb.Append((bool)v ? "true" : "false"); return; }
            if (v is double) { WriteNumber(sb, (double)v); return; }
            if (v is int) { sb.Append(((int)v).ToString(CultureInfo.InvariantCulture)); return; }
            if (v is long) { sb.Append(((long)v).ToString(CultureInfo.InvariantCulture)); return; }
            if (v is float) { WriteNumber(sb, (float)v); return; }
            if (v is decimal) { sb.Append(((decimal)v).ToString(CultureInfo.InvariantCulture)); return; }
            var dict = v as IDictionary<string, object>;
            if (dict != null)
            {
                sb.Append('{');
                bool first = true;
                foreach (var kv in dict)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    WriteString(sb, kv.Key);
                    sb.Append(':');
                    Write(sb, kv.Value);
                }
                sb.Append('}');
                return;
            }
            var list = v as System.Collections.IEnumerable;
            if (list != null)
            {
                sb.Append('[');
                bool first = true;
                foreach (object item in list)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    Write(sb, item);
                }
                sb.Append(']');
                return;
            }
            WriteString(sb, Convert.ToString(v, CultureInfo.InvariantCulture));
        }

        static void WriteNumber(StringBuilder sb, double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) { sb.Append("null"); return; }
            if (d == Math.Floor(d) && Math.Abs(d) < 1e15) sb.Append(((long)d).ToString(CultureInfo.InvariantCulture));
            else sb.Append(d.ToString("R", CultureInfo.InvariantCulture));
        }

        static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    default:
                        if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }
    }
}
