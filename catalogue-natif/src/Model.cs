// Rail Empire Catalogue — modèle : catalogue du jeu + surcouche externe
// (format 'rail-empire-catalog' v1 : modifications / deletions / imports).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;

namespace RailEmpireCatalogue
{
    public sealed class CargoType
    {
        public string Category; public string CategoryName; public string Type; public string Name; public string Unit;
    }

    public sealed class Entry
    {
        public readonly Dictionary<string, object> Original;   // fiche telle que livrée par le jeu (null si import)
        public Dictionary<string, object> Current;              // fiche courante (éditée ou non)
        public bool IsImport;
        public bool IsDeleted;

        public Entry(Dictionary<string, object> original, bool isImport)
        {
            IsImport = isImport;
            Original = isImport ? null : original;
            Current = new Dictionary<string, object>(original);
        }

        public string Id { get { return Str("id"); } }
        public string Str(string key) { object v; return Current.TryGetValue(key, out v) && v != null ? Convert.ToString(v, CultureInfo.InvariantCulture) : ""; }
        public double Num(string key) { object v; if (!Current.TryGetValue(key, out v) || v == null) return 0; if (v is double) return (double)v; double d; return double.TryParse(Convert.ToString(v, CultureInfo.InvariantCulture), NumberStyles.Float, CultureInfo.InvariantCulture, out d) ? d : 0; }
        public List<string> StrList(string key)
        {
            var out_ = new List<string>();
            object v; if (!Current.TryGetValue(key, out v)) return out_;
            var l = v as List<object>; if (l == null) return out_;
            foreach (object o in l) if (o != null) out_.Add(Convert.ToString(o, CultureInfo.InvariantCulture));
            return out_;
        }

        public static readonly string[] EditableKeys = {
            "name", "category", "traction", "maxSpeed", "mass", "power", "passengerCapacity", "freightCapacity", "length",
            "imageData", "seriesName", "numberStart", "purchasePrice", "cargoTypes", "wagonSubCategory", "notes",
            "identityCountry", "identityOperator", "realIdentitySeries",
        };

        public bool IsModified
        {
            get
            {
                if (IsImport || Original == null) return false;
                foreach (string k in EditableKeys) if (!SameValue(Get(Original, k), Get(Current, k))) return true;
                return false;
            }
        }

        public void Revert() { if (Original != null) Current = new Dictionary<string, object>(Original); }

        // Ne renvoie que l'id + les champs éditables réellement changés (payload minimal pour le jeu).
        public Dictionary<string, object> ModificationPayload()
        {
            var d = new Dictionary<string, object>();
            d["id"] = Id;
            foreach (string k in EditableKeys)
            {
                object cur = Get(Current, k);
                if (!SameValue(Get(Original, k), cur)) d[k] = cur;
            }
            return d;
        }

        static object Get(Dictionary<string, object> d, string k) { object v; return d.TryGetValue(k, out v) ? v : null; }

        static bool SameValue(object a, object b)
        {
            if (a == null && b == null) return true;
            if (a == null || b == null)
            {
                // "" / 0 / liste vide sont équivalents à absent.
                object x = a ?? b;
                if (x is string) return ((string)x).Length == 0;
                if (x is double) return (double)x == 0;
                var l = x as List<object>; if (l != null) return l.Count == 0;
                return false;
            }
            var la = a as List<object>; var lb = b as List<object>;
            if (la != null && lb != null)
            {
                if (la.Count != lb.Count) return false;
                for (int i = 0; i < la.Count; i++) if (!SameValue(la[i], lb[i])) return false;
                return true;
            }
            if (a is double && b is double) return Math.Abs((double)a - (double)b) < 1e-9;
            return string.Equals(Convert.ToString(a, CultureInfo.InvariantCulture), Convert.ToString(b, CultureInfo.InvariantCulture), StringComparison.Ordinal);
        }
    }

    public sealed class CatalogStore
    {
        public readonly List<Entry> Entries = new List<Entry>();
        public readonly Dictionary<string, Entry> ById = new Dictionary<string, Entry>(StringComparer.Ordinal);
        public readonly List<CargoType> CargoTypes = new List<CargoType>();
        public string GameVersion = "";
        public string ImageRoot = "img/catalog";
        public string BundlePath;          // dernier fichier externe ouvert/enregistré
        public bool Dirty;

        public void LoadGameCatalog(string path)
        {
            string text = File.ReadAllText(path, Encoding.UTF8);
            var root = MiniJson.Parse(text) as Dictionary<string, object>;
            if (root == null) throw new FormatException("catalog.native.json : racine invalide");
            object v;
            if (root.TryGetValue("gameVersion", out v) && v != null) GameVersion = v.ToString();
            if (root.TryGetValue("imageRoot", out v) && v != null) ImageRoot = v.ToString();
            Entries.Clear(); ById.Clear(); CargoTypes.Clear();
            var cats = root.ContainsKey("cargoCategories") ? root["cargoCategories"] as List<object> : null;
            if (cats != null)
                foreach (object co in cats)
                {
                    var cd = co as Dictionary<string, object>; if (cd == null) continue;
                    string ckey = S(cd, "key"), cname = S(cd, "name");
                    var types = cd.ContainsKey("types") ? cd["types"] as List<object> : null; if (types == null) continue;
                    foreach (object to in types)
                    {
                        var td = to as Dictionary<string, object>; if (td == null) continue;
                        CargoTypes.Add(new CargoType { Category = ckey, CategoryName = cname, Type = S(td, "type"), Name = S(td, "name"), Unit = S(td, "unit") });
                    }
                }
            var list = root.ContainsKey("entries") ? root["entries"] as List<object> : null;
            if (list == null) throw new FormatException("catalog.native.json : 'entries' manquant");
            foreach (object o in list)
            {
                var d = o as Dictionary<string, object>; if (d == null) continue;
                var e = new Entry(d, false);
                if (e.Id.Length == 0 || ById.ContainsKey(e.Id)) continue;
                Entries.Add(e); ById[e.Id] = e;
            }
        }

        static string S(Dictionary<string, object> d, string k) { object v; return d.TryGetValue(k, out v) && v != null ? Convert.ToString(v, CultureInfo.InvariantCulture) : ""; }

        public Entry AddImport(Dictionary<string, object> data)
        {
            object idv; string id = data.TryGetValue("id", out idv) && idv != null ? idv.ToString() : "";
            if (id.Length == 0 || ById.ContainsKey(id)) { id = "ext-" + Guid.NewGuid().ToString("N").Substring(0, 12); data["id"] = id; }
            if (!data.ContainsKey("_source")) data["_source"] = "Rail Empire Catalogue (natif)";
            var e = new Entry(data, true);
            Entries.Add(e); ById[id] = e; Dirty = true;
            return e;
        }

        public void Remove(Entry e)
        {
            if (e.IsImport) { Entries.Remove(e); ById.Remove(e.Id); }
            else e.IsDeleted = true;
            Dirty = true;
        }

        // ------------------------------------------------------- surcouche externe
        public void ResetOverlay()
        {
            for (int i = Entries.Count - 1; i >= 0; i--)
            {
                var e = Entries[i];
                if (e.IsImport) { ById.Remove(e.Id); Entries.RemoveAt(i); continue; }
                e.IsDeleted = false; e.Revert();
            }
            Dirty = false; BundlePath = null;
        }

        public struct ApplyResult { public int Modified, Deleted, Imported, Skipped; }

        public ApplyResult LoadBundle(string path)
        {
            var root = MiniJson.Parse(File.ReadAllText(path, Encoding.UTF8)) as Dictionary<string, object>;
            if (root == null || S(root, "format") != "rail-empire-catalog") throw new FormatException("Ce fichier n'est pas un catalogue externe Rail Empire (format 'rail-empire-catalog').");
            var r = new ApplyResult();
            var dels = root.ContainsKey("deletions") ? root["deletions"] as List<object> : null;
            if (dels != null) foreach (object o in dels) { Entry e; if (o != null && ById.TryGetValue(o.ToString(), out e) && !e.IsImport) { e.IsDeleted = true; r.Deleted++; } else r.Skipped++; }
            var mods = root.ContainsKey("modifications") ? root["modifications"] as List<object> : null;
            if (mods != null) foreach (object o in mods)
            {
                var d = o as Dictionary<string, object>; Entry e;
                if (d == null || !ById.TryGetValue(S(d, "id"), out e)) { r.Skipped++; continue; }
                foreach (var kv in d) if (kv.Key != "id") e.Current[kv.Key] = kv.Value;
                r.Modified++;
            }
            var imps = root.ContainsKey("imports") ? root["imports"] as List<object> : null;
            if (imps != null) foreach (object o in imps)
            {
                var d = o as Dictionary<string, object>;
                if (d == null || ById.ContainsKey(S(d, "id"))) { r.Skipped++; continue; }
                AddImport(new Dictionary<string, object>(d)); r.Imported++;
            }
            BundlePath = path; Dirty = false;
            return r;
        }

        public Dictionary<string, object> BuildBundle()
        {
            var mods = new List<object>(); var dels = new List<object>(); var imps = new List<object>();
            foreach (var e in Entries)
            {
                if (e.IsImport) { imps.Add(e.Current); continue; }
                if (e.IsDeleted) { dels.Add(e.Id); continue; }
                if (e.IsModified) mods.Add(e.ModificationPayload());
            }
            var meta = new Dictionary<string, object>();
            meta["tool"] = "Rail Empire Catalogue (application native Windows)";
            meta["toolVersion"] = Program.AppVersion;
            var b = new Dictionary<string, object>();
            b["format"] = "rail-empire-catalog";
            b["version"] = 1.0;
            b["createdAt"] = DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
            b["catalogBase"] = GameVersion;
            b["modifications"] = mods;
            b["deletions"] = dels;
            b["imports"] = imps;
            b["metadata"] = meta;
            return b;
        }

        public void SaveBundle(string path)
        {
            File.WriteAllText(path, MiniJson.Serialize(BuildBundle()), new UTF8Encoding(false));
            BundlePath = path; Dirty = false;
        }

        public int CountModified() { int n = 0; foreach (var e in Entries) if (!e.IsImport && !e.IsDeleted && e.IsModified) n++; return n; }
        public int CountDeleted() { int n = 0; foreach (var e in Entries) if (e.IsDeleted) n++; return n; }
        public int CountImports() { int n = 0; foreach (var e in Entries) if (e.IsImport) n++; return n; }
    }

    // Règles reprises de la page Matériel du jeu (ui.ts : _computeStockTonnage / _calculateStockPrice).
    public static class GameRules
    {
        public static readonly string[] Categories = { "locomotive", "automotrice", "voiture", "wagon" };
        public static readonly string[] CategoryLabels = { "Locomotive", "Automotrice", "Voiture", "Wagon" };
        public static readonly string[] Tractions = { "none", "diesel", "electrique", "vapeur", "bi", "Diesel", "Vapeur", "1.5kV", "3kV", "15kV", "25kV", "3e Rail" };
        public static readonly string[] WagonSubcats = { "", "tombereau", "citerne", "gaz", "porte-auto", "tremie", "cerealier", "ciment", "silos", "plat", "ttx", "intermodal" };
        public static readonly string[] WagonSubcatLabels = { "— Sélectionner —", "Tombereau", "Citerne", "Gaz", "Porte-Auto", "Trémie", "Céréalier", "Ciment", "Silos", "Plat", "TTX", "Intermodal" };

        public static double Tonnage(string category, double mass, double freightCap)
        {
            return category == "wagon" ? Math.Round((mass + freightCap) * 10) / 10 : Math.Round(mass * 10) / 10;
        }

        public static double Price(string category, double power, double capacity, double freightCap)
        {
            if (category == "locomotive" || category == "automotrice") return Math.Max(0, Math.Round(power * 1000));
            if (category == "voiture") return Math.Max(0, Math.Round(capacity * 100));
            if (category == "wagon") return Math.Max(0, Math.Round(freightCap * 100));
            return 0;
        }
    }
}
