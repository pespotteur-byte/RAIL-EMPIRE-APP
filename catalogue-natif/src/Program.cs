using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace RailEmpireCatalogue
{
    public static class Program
    {
        public const string AppVersion = "2.0.0";
        public static readonly string AppDir = AppDomain.CurrentDomain.BaseDirectory;
        static readonly string SettingsPath = Path.Combine(AppDir, "settings.json");

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.ThreadException += (s, e) => MessageBox.Show("Erreur inattendue :\n" + e.Exception.Message, "Rail Empire Catalogue", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Application.Run(new MainForm());
        }

        static Dictionary<string, object> ReadSettings()
        {
            try { if (File.Exists(SettingsPath)) return MiniJson.Parse(File.ReadAllText(SettingsPath, Encoding.UTF8)) as Dictionary<string, object> ?? new Dictionary<string, object>(); }
            catch { }
            return new Dictionary<string, object>();
        }

        public static string LoadSetting(string key)
        {
            object v; return ReadSettings().TryGetValue(key, out v) && v != null ? v.ToString() : "";
        }

        public static void SaveSetting(string key, string value)
        {
            var d = ReadSettings(); d[key] = value;
            try { File.WriteAllText(SettingsPath, MiniJson.Serialize(d), new UTF8Encoding(false)); } catch { }
        }
    }
}
