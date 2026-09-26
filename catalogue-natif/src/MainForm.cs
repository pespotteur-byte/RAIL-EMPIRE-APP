// Rail Empire Catalogue — fenêtre principale (WinForms natif, .NET 4.0, x86).
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Text;
using System.Windows.Forms;

namespace RailEmpireCatalogue
{
    public sealed class MainForm : Form
    {
        readonly CatalogStore store = new CatalogStore();
        readonly List<Entry> view = new List<Entry>();
        Entry selected;
        bool loadingFields;
        string gameDir;                       // dossier du jeu (pour img/catalog) si l'appli est livrée à part
        readonly Dictionary<string, Image> imageCache = new Dictionary<string, Image>();

        // --- gauche
        TextBox txtSearch; ComboBox cbCat, cbTraction, cbCountry, cbOperator, cbState;
        ListView list; Label lblCount;
        // --- droite
        PictureBox pic; Label lblImgInfo; Button btnImage, btnImageReset;
        TextBox txtName, txtSeries, txtCountry, txtOperator, txtNotes, txtId, txtSource;
        ComboBox cbEditCat, cbEditTraction, cbEditSubcat;
        NumericUpDown nSpeed, nPower, nLength, nMass, nCap, nFreight, nPrice;
        CheckBox chkAutoPrice;
        Label lblTonnage, lblPriceCalc, lblState;
        CheckedListBox clbCargo; Panel pnlCargo, pnlSubcat;
        Button btnApply, btnRevert, btnDelete, btnNew, btnDuplicate;
        StatusStrip status; ToolStripStatusLabel stMsg, stOverlay; SplitContainer split;

        public MainForm()
        {
            Text = "Rail Empire Catalogue — éditeur de matériel roulant";
            Width = 1360; Height = 860; MinimumSize = new Size(1000, 640);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 9f);
            BuildMenu();
            BuildBody();
            Load += (s, e) => { split.SplitterDistance = Math.Max(300, split.Width - 540); };
            Shown += (s, e) => LoadEverything();
            FormClosing += OnClosing;
        }

        // ================================================================ construction UI
        void BuildMenu()
        {
            var menu = new MenuStrip();
            var mFile = new ToolStripMenuItem("&Fichier");
            ((ToolStripMenuItem)mFile.DropDownItems.Add("Ouvrir un catalogue externe (.json)…", null, (s, e) => OpenBundle())).ShortcutKeys = Keys.Control | Keys.O;
            ((ToolStripMenuItem)mFile.DropDownItems.Add("Enregistrer le catalogue externe", null, (s, e) => SaveBundle(false))).ShortcutKeys = Keys.Control | Keys.S;
            mFile.DropDownItems.Add("Enregistrer sous…", null, (s, e) => SaveBundle(true));
            mFile.DropDownItems.Add(new ToolStripSeparator());
            mFile.DropDownItems.Add("Repartir du catalogue d'origine (annuler toutes les modifications)", null, (s, e) => ResetOverlay());
            mFile.DropDownItems.Add(new ToolStripSeparator());
            mFile.DropDownItems.Add("Choisir le dossier du jeu (images img/catalog)…", null, (s, e) => ChooseGameDir());
            mFile.DropDownItems.Add(new ToolStripSeparator());
            mFile.DropDownItems.Add("Quitter", null, (s, e) => Close());
            var mEdit = new ToolStripMenuItem("&Engin");
            ((ToolStripMenuItem)mEdit.DropDownItems.Add("Nouvel engin", null, (s, e) => NewEntry())).ShortcutKeys = Keys.Control | Keys.N;
            ((ToolStripMenuItem)mEdit.DropDownItems.Add("Dupliquer l'engin sélectionné", null, (s, e) => DuplicateEntry())).ShortcutKeys = Keys.Control | Keys.D;
            ((ToolStripMenuItem)mEdit.DropDownItems.Add("Supprimer / restaurer l'engin sélectionné", null, (s, e) => DeleteEntry())).ShortcutKeys = Keys.Delete;
            mEdit.DropDownItems.Add("Rétablir la fiche d'origine", null, (s, e) => RevertEntry());
            var mHelp = new ToolStripMenuItem("&Aide");
            mHelp.DropDownItems.Add("Comment utiliser le catalogue dans le jeu", null, (s, e) => MessageBox.Show(this,
                "1. Modifiez, ajoutez ou supprimez des engins ici.\n" +
                "2. Fichier → Enregistrer le catalogue externe (.json).\n" +
                "3. Dans Rail Empire : page Matériel roulant → « Importer un catalogue » → choisissez ce .json.\n\n" +
                "Le fichier ne contient que vos changements (modifications / suppressions / ajouts) : il reste léger et " +
                "s'applique par-dessus le catalogue du jeu. Les images ajoutées sont embarquées dans le fichier.",
                "Aide", MessageBoxButtons.OK, MessageBoxIcon.Information));
            mHelp.DropDownItems.Add("À propos", null, (s, e) => MessageBox.Show(this, "Rail Empire Catalogue " + Program.AppVersion + "\nApplication native Windows (WinForms, .NET 4.0, x86).\nCatalogue du jeu : version " + store.GameVersion + " · " + store.Entries.Count.ToString("N0", Fr) + " fiches.", "À propos"));
            menu.Items.Add(mFile); menu.Items.Add(mEdit); menu.Items.Add(mHelp);
            MainMenuStrip = menu; Controls.Add(menu);
        }

        static readonly CultureInfo Fr = CultureInfo.GetCultureInfo("fr-FR");

        void BuildBody()
        {
            status = new StatusStrip();
            stMsg = new ToolStripStatusLabel("Chargement…") { Spring = true, TextAlign = ContentAlignment.MiddleLeft };
            stOverlay = new ToolStripStatusLabel("");
            status.Items.Add(stMsg); status.Items.Add(stOverlay);
            Controls.Add(status);

            split = new SplitContainer { Dock = DockStyle.Fill, FixedPanel = FixedPanel.Panel2, Panel2MinSize = 420 };
            Controls.Add(split);
            split.BringToFront();

            // ---------- panneau gauche : filtres + liste
            var left = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 1, RowCount = 3, Padding = new Padding(6) };
            left.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            left.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            left.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            split.Panel1.Controls.Add(left);

            var filters = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true };
            txtSearch = new TextBox { Width = 260 };
            SetCue(txtSearch, "Rechercher (nom, série, type, id…)");
            txtSearch.TextChanged += (s, e) => RefreshView();
            cbCat = MakeFilter("Toutes catégories racines", 170);
            cbTraction = MakeFilter("Toutes tractions", 140);
            cbCountry = MakeFilter("Tous pays", 160);
            cbOperator = MakeFilter("Tous opérateurs", 190);
            cbState = MakeFilter("Tous états", 170);
            cbState.Items.AddRange(new object[] { "Modifiés", "Ajoutés", "Supprimés", "Modifiés + ajoutés + supprimés", "Non modifiés" });
            filters.Controls.AddRange(new Control[] { txtSearch, cbCat, cbTraction, cbCountry, cbOperator, cbState });
            left.Controls.Add(filters, 0, 0);

            list = new ListView { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, VirtualMode = true, HideSelection = false, MultiSelect = false, GridLines = false };
            list.Columns.Add("", 22);
            list.Columns.Add("Nom", 300);
            list.Columns.Add("Série", 150);
            list.Columns.Add("Cat.", 80);
            list.Columns.Add("Traction", 70);
            list.Columns.Add("Vmax", 50, HorizontalAlignment.Right);
            list.Columns.Add("kW", 55, HorizontalAlignment.Right);
            list.Columns.Add("Places", 50, HorizontalAlignment.Right);
            list.Columns.Add("Fret t", 50, HorizontalAlignment.Right);
            list.Columns.Add("Prix €", 80, HorizontalAlignment.Right);
            list.Columns.Add("Pays", 90);
            list.RetrieveVirtualItem += OnRetrieveItem;
            list.SelectedIndexChanged += (s, e) => { if (list.SelectedIndices.Count > 0) SelectEntry(view[list.SelectedIndices[0]]); };
            list.ColumnClick += OnColumnClick;
            left.Controls.Add(list, 0, 1);

            lblCount = new Label { AutoSize = true, ForeColor = Color.DimGray, Padding = new Padding(0, 4, 0, 0) };
            left.Controls.Add(lblCount, 0, 2);

            // ---------- panneau droit : fiche (reprend le formulaire "Ajouter un engin" du jeu)
            var right = new Panel { Dock = DockStyle.Fill, AutoScroll = true, Padding = new Padding(8) };
            split.Panel2.Controls.Add(right);
            var grid = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 2 };
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
            grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            right.Controls.Add(grid);

            lblState = new Label { AutoSize = true, Font = new Font(Font, FontStyle.Bold), Dock = DockStyle.Fill, Padding = new Padding(0, 0, 0, 6) };
            grid.RowCount = 1; grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            grid.Controls.Add(lblState, 0, 0); grid.SetColumnSpan(lblState, 2);

            pic = new PictureBox { Height = 150, Dock = DockStyle.Top, SizeMode = PictureBoxSizeMode.Zoom, BorderStyle = BorderStyle.FixedSingle, BackColor = Color.White };
            var picRow = new Panel { Dock = DockStyle.Fill, Height = 186 };
            var picBtns = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Bottom };
            btnImage = new Button { Text = "Choisir une image…", AutoSize = true }; btnImage.Click += (s, e) => ChooseImage();
            btnImageReset = new Button { Text = "Image d'origine", AutoSize = true }; btnImageReset.Click += (s, e) => ResetImage();
            lblImgInfo = new Label { AutoSize = true, ForeColor = Color.DimGray, Padding = new Padding(6, 6, 0, 0) };
            picBtns.Controls.AddRange(new Control[] { btnImage, btnImageReset, lblImgInfo });
            picRow.Controls.Add(picBtns);
            picRow.Controls.Add(pic);
            AddRow(grid, "Image de l'engin", picRow);
            grid.RowStyles[grid.RowCount - 1] = new RowStyle(SizeType.Absolute, 192);

            txtName = AddText(grid, "Nom de l'engin");
            cbEditCat = AddCombo(grid, "Catégorie", GameRules.CategoryLabels, false);
            txtSeries = AddText(grid, "Série (ex. BB26000)");
            cbEditTraction = AddCombo(grid, "Traction", GameRules.Tractions, true);
            nSpeed = AddNum(grid, "Vitesse max (km/h)", 0, 600, 0);
            nPower = AddNum(grid, "Puissance (kW)", 0, 50000, 0);
            nLength = AddNum(grid, "Longueur (m)", 0, 500, 2);
            nMass = AddNum(grid, "Masse à vide (t)", 0, 2000, 1);
            lblTonnage = new Label { AutoSize = true, Padding = new Padding(3, 5, 0, 0) };
            AddRow(grid, "Tonnage calculé", lblTonnage);
            nCap = AddNum(grid, "Places voyageurs", 0, 5000, 0);
            nFreight = AddNum(grid, "Capacité fret (t)", 0, 5000, 1);

            var priceRow = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill };
            nPrice = new NumericUpDown { Width = 120, Maximum = 100000000, ThousandsSeparator = true };
            chkAutoPrice = new CheckBox { Text = "auto (règle du jeu)", AutoSize = true, Padding = new Padding(6, 3, 0, 0) };
            lblPriceCalc = new Label { AutoSize = true, ForeColor = Color.DimGray, Padding = new Padding(6, 5, 0, 0) };
            priceRow.Controls.AddRange(new Control[] { nPrice, chkAutoPrice, lblPriceCalc });
            AddRow(grid, "Prix d'achat (€)", priceRow);
            chkAutoPrice.CheckedChanged += (s, e) => { nPrice.Enabled = !chkAutoPrice.Checked; Recompute(); MarkFieldChange(); };
            nPrice.ValueChanged += (s, e) => MarkFieldChange();

            cbEditSubcat = new ComboBox { DropDownStyle = ComboBoxStyle.DropDownList, Dock = DockStyle.Fill };
            cbEditSubcat.Items.AddRange(GameRules.WagonSubcatLabels);
            cbEditSubcat.SelectedIndexChanged += (s, e) => MarkFieldChange();
            pnlSubcat = new Panel { AutoSize = true, Dock = DockStyle.Fill }; pnlSubcat.Controls.Add(cbEditSubcat);
            AddRow(grid, "Sous-catégorie wagon", pnlSubcat);

            clbCargo = new CheckedListBox { Height = 190, Dock = DockStyle.Fill, CheckOnClick = true, IntegralHeight = false };
            clbCargo.ItemCheck += (s, e) => { if (!loadingFields) BeginInvoke(new Action(MarkFieldChange)); };
            pnlCargo = new Panel { Height = 190, Dock = DockStyle.Fill }; pnlCargo.Controls.Add(clbCargo);
            AddRow(grid, "Types de fret acceptés", pnlCargo);

            txtCountry = AddText(grid, "Pays");
            txtOperator = AddText(grid, "Opérateur");
            txtNotes = AddText(grid, "Notes"); txtNotes.Multiline = true; txtNotes.Height = 44;
            txtId = AddText(grid, "Identifiant"); txtId.ReadOnly = true; txtId.BackColor = SystemColors.Control;
            txtSource = AddText(grid, "Source"); txtSource.ReadOnly = true; txtSource.BackColor = SystemColors.Control;

            var btns = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill, Padding = new Padding(0, 8, 0, 0) };
            btnApply = new Button { Text = "Enregistrer la fiche", AutoSize = true, Font = new Font(Font, FontStyle.Bold) }; btnApply.Click += (s, e) => ApplyFields();
            btnRevert = new Button { Text = "Rétablir l'origine", AutoSize = true }; btnRevert.Click += (s, e) => RevertEntry();
            btnDelete = new Button { Text = "Supprimer", AutoSize = true }; btnDelete.Click += (s, e) => DeleteEntry();
            btnDuplicate = new Button { Text = "Dupliquer", AutoSize = true }; btnDuplicate.Click += (s, e) => DuplicateEntry();
            btnNew = new Button { Text = "+ Nouvel engin", AutoSize = true }; btnNew.Click += (s, e) => NewEntry();
            btns.Controls.AddRange(new Control[] { btnApply, btnRevert, btnDelete, btnDuplicate, btnNew });
            grid.Controls.Add(btns, 0, grid.RowCount); grid.SetColumnSpan(btns, 2);

            foreach (var t in new[] { txtName, txtSeries, txtCountry, txtOperator, txtNotes }) t.TextChanged += (s, e) => MarkFieldChange();
            cbEditCat.SelectedIndexChanged += (s, e) => { OnCategoryChanged(); MarkFieldChange(); };
            cbEditTraction.TextChanged += (s, e) => MarkFieldChange();
            foreach (var n in new[] { nSpeed, nPower, nLength, nMass, nCap, nFreight }) n.ValueChanged += (s, e) => { Recompute(); MarkFieldChange(); };
            SetEditorEnabled(false);
        }

        ComboBox MakeFilter(string all, int width)
        {
            var cb = new ComboBox { Width = width, DropDownStyle = ComboBoxStyle.DropDownList };
            cb.Items.Add(all); cb.SelectedIndex = 0;
            cb.SelectedIndexChanged += (s, e) => RefreshView();
            return cb;
        }

        static void AddRow(TableLayoutPanel grid, string label, Control c)
        {
            int r = grid.RowCount++;
            grid.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            grid.Controls.Add(new Label { Text = label, AutoSize = true, Padding = new Padding(0, 6, 0, 0) }, 0, r);
            c.Margin = new Padding(3, 3, 3, 3);
            grid.Controls.Add(c, 1, r);
        }
        static TextBox AddText(TableLayoutPanel grid, string label) { var t = new TextBox { Dock = DockStyle.Fill }; AddRow(grid, label, t); return t; }
        static ComboBox AddCombo(TableLayoutPanel grid, string label, string[] items, bool editable)
        {
            var cb = new ComboBox { Dock = DockStyle.Fill, DropDownStyle = editable ? ComboBoxStyle.DropDown : ComboBoxStyle.DropDownList };
            cb.Items.AddRange(items); AddRow(grid, label, cb); return cb;
        }
        static NumericUpDown AddNum(TableLayoutPanel grid, string label, decimal min, decimal max, int decimals)
        {
            var n = new NumericUpDown { Minimum = min, Maximum = max, DecimalPlaces = decimals, Width = 120 };
            AddRow(grid, label, n); return n;
        }

        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
        static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, string lParam);
        static void SetCue(TextBox t, string cue) { try { SendMessage(t.Handle, 0x1501, (IntPtr)1, cue); } catch { } }

        // ================================================================ chargement
        void LoadEverything()
        {
            string dataPath = Path.Combine(Program.AppDir, Path.Combine("data", "catalog.native.json"));
            if (!File.Exists(dataPath))
            {
                MessageBox.Show(this, "Fichier introuvable :\n" + dataPath + "\n\nL'application doit être lancée depuis son dossier complet (RailEmpireCatalogue.exe + data\\catalog.native.json).", "Catalogue absent", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close(); return;
            }
            gameDir = Program.LoadSetting("gameDir");
            Cursor = Cursors.WaitCursor; stMsg.Text = "Chargement du catalogue du jeu…"; Refresh();
            try { store.LoadGameCatalog(dataPath); }
            catch (Exception ex) { MessageBox.Show(this, "Catalogue illisible :\n" + ex.Message, "Erreur", MessageBoxButtons.OK, MessageBoxIcon.Error); Close(); return; }
            finally { Cursor = Cursors.Default; }
            PopulateCargoList();
            PopulateFilters();
            RefreshView();
            UpdateStatus("Catalogue du jeu chargé (version " + store.GameVersion + ")");
            if (ResolveImageDir() == null)
                UpdateStatus("Images introuvables : Fichier → « Choisir le dossier du jeu » pour afficher les dessins des engins.");
        }

        void PopulateCargoList()
        {
            clbCargo.Items.Clear();
            string lastCat = null;
            foreach (var ct in store.CargoTypes)
            {
                if (ct.CategoryName != lastCat) { lastCat = ct.CategoryName; }
                clbCargo.Items.Add(new CargoItem(ct));
            }
        }

        sealed class CargoItem { public readonly CargoType T; public CargoItem(CargoType t) { T = t; } public override string ToString() { return T.CategoryName + " › " + T.Name + (T.Unit.Length > 0 ? " (" + T.Unit + ")" : ""); } }

        void PopulateFilters()
        {
            FillFilter(cbCat, e => e.Str("category"));
            FillFilter(cbTraction, e => e.Str("traction"));
            FillFilter(cbCountry, e => e.Str("identityCountry"));
            FillFilter(cbOperator, e => e.Str("identityOperator"));
        }

        void FillFilter(ComboBox cb, Func<Entry, string> get)
        {
            var set = new SortedSet<string>(StringComparer.Create(Fr, true));
            foreach (var e in store.Entries) { string v = get(e); if (v.Length > 0) set.Add(v); }
            object first = cb.Items[0];
            cb.BeginUpdate(); cb.Items.Clear(); cb.Items.Add(first); foreach (string v in set) cb.Items.Add(v); cb.SelectedIndex = 0; cb.EndUpdate();
        }

        // ================================================================ liste / filtres
        int sortCol = 1; bool sortAsc = true;

        void RefreshView()
        {
            string q = txtSearch.Text.Trim().ToLowerInvariant();
            string fCat = cbCat.SelectedIndex > 0 ? (string)cbCat.SelectedItem : null;
            string fTr = cbTraction.SelectedIndex > 0 ? (string)cbTraction.SelectedItem : null;
            string fCo = cbCountry.SelectedIndex > 0 ? (string)cbCountry.SelectedItem : null;
            string fOp = cbOperator.SelectedIndex > 0 ? (string)cbOperator.SelectedItem : null;
            int fSt = cbState.SelectedIndex;
            view.Clear();
            foreach (var e in store.Entries)
            {
                if (fCat != null && e.Str("category") != fCat) continue;
                if (fTr != null && e.Str("traction") != fTr) continue;
                if (fCo != null && e.Str("identityCountry") != fCo) continue;
                if (fOp != null && e.Str("identityOperator") != fOp) continue;
                if (fSt > 0)
                {
                    bool mod = !e.IsImport && !e.IsDeleted && e.IsModified;
                    bool ok = fSt == 1 ? mod : fSt == 2 ? e.IsImport : fSt == 3 ? e.IsDeleted : fSt == 4 ? (mod || e.IsImport || e.IsDeleted) : !(mod || e.IsImport || e.IsDeleted);
                    if (!ok) continue;
                }
                if (q.Length > 0)
                {
                    if (e.Str("name").ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0 &&
                        e.Str("seriesName").ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0 &&
                        e.Str("category").ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0 &&
                        e.Str("identityOperator").ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0 &&
                        e.Id.ToLowerInvariant().IndexOf(q, StringComparison.Ordinal) < 0) continue;
                }
                view.Add(e);
            }
            SortView();
            list.VirtualListSize = 0;
            list.VirtualListSize = view.Count;
            list.Invalidate();
            lblCount.Text = view.Count.ToString("N0", Fr) + " engin(s) affiché(s) sur " + store.Entries.Count.ToString("N0", Fr);
            UpdateOverlayLabel();
            if (selected != null)
            {
                int idx = view.IndexOf(selected);
                if (idx >= 0) { list.SelectedIndices.Clear(); list.SelectedIndices.Add(idx); list.EnsureVisible(idx); }
            }
        }

        void OnColumnClick(object s, ColumnClickEventArgs e)
        {
            if (e.Column == 0) return;
            if (sortCol == e.Column) sortAsc = !sortAsc; else { sortCol = e.Column; sortAsc = true; }
            RefreshView();
        }

        void SortView()
        {
            Comparison<Entry> cmp;
            switch (sortCol)
            {
                case 2: cmp = (a, b) => string.Compare(a.Str("seriesName"), b.Str("seriesName"), Fr, CompareOptions.IgnoreCase); break;
                case 3: cmp = (a, b) => string.CompareOrdinal(a.Str("category"), b.Str("category")); break;
                case 4: cmp = (a, b) => string.CompareOrdinal(a.Str("traction"), b.Str("traction")); break;
                case 5: cmp = (a, b) => a.Num("maxSpeed").CompareTo(b.Num("maxSpeed")); break;
                case 6: cmp = (a, b) => a.Num("power").CompareTo(b.Num("power")); break;
                case 7: cmp = (a, b) => a.Num("passengerCapacity").CompareTo(b.Num("passengerCapacity")); break;
                case 8: cmp = (a, b) => a.Num("freightCapacity").CompareTo(b.Num("freightCapacity")); break;
                case 9: cmp = (a, b) => a.Num("purchasePrice").CompareTo(b.Num("purchasePrice")); break;
                case 10: cmp = (a, b) => string.Compare(a.Str("identityCountry"), b.Str("identityCountry"), Fr, CompareOptions.IgnoreCase); break;
                default: cmp = (a, b) => string.Compare(a.Str("name"), b.Str("name"), Fr, CompareOptions.IgnoreCase); break;
            }
            view.Sort((a, b) => { int r = cmp(a, b); if (r == 0) r = string.CompareOrdinal(a.Id, b.Id); return sortAsc ? r : -r; });
        }

        void OnRetrieveItem(object s, RetrieveVirtualItemEventArgs e)
        {
            var en = view[e.ItemIndex];
            string flag = en.IsDeleted ? "✕" : en.IsImport ? "+" : en.IsModified ? "●" : "";
            var it = new ListViewItem(flag);
            it.SubItems.Add(en.Str("name"));
            it.SubItems.Add(en.Str("seriesName"));
            it.SubItems.Add(en.Str("category"));
            it.SubItems.Add(en.Str("traction"));
            it.SubItems.Add(N(en.Num("maxSpeed")));
            it.SubItems.Add(N(en.Num("power")));
            it.SubItems.Add(N(en.Num("passengerCapacity")));
            it.SubItems.Add(N(en.Num("freightCapacity")));
            it.SubItems.Add(en.Num("purchasePrice").ToString("N0", Fr));
            it.SubItems.Add(en.Str("identityCountry"));
            if (en.IsDeleted) it.ForeColor = Color.Gray;
            else if (en.IsImport) it.ForeColor = Color.FromArgb(0, 110, 0);
            else if (en.IsModified) it.ForeColor = Color.FromArgb(0, 70, 170);
            e.Item = it;
        }

        static string N(double d) { return d == 0 ? "" : d.ToString("0.#", Fr); }

        // ================================================================ fiche
        void SelectEntry(Entry e)
        {
            if (e == selected) return;
            if (selected != null && fieldsDirty && !ConfirmDiscardFields()) { RefreshView(); return; }
            selected = e;
            LoadFields();
        }

        bool fieldsDirty;
        void MarkFieldChange() { if (loadingFields || selected == null) return; fieldsDirty = true; btnApply.Enabled = true; UpdateStateLabel(); }

        bool ConfirmDiscardFields()
        {
            var r = MessageBox.Show(this, "La fiche en cours a des changements non enregistrés.\nEnregistrer avant de continuer ?", "Fiche modifiée", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
            if (r == DialogResult.Cancel) return false;
            if (r == DialogResult.Yes) ApplyFields();
            fieldsDirty = false;
            return true;
        }

        void SetEditorEnabled(bool on)
        {
            foreach (Control c in new Control[] { txtName, txtSeries, cbEditCat, cbEditTraction, nSpeed, nPower, nLength, nMass, nCap, nFreight, nPrice, chkAutoPrice, cbEditSubcat, clbCargo, txtCountry, txtOperator, txtNotes, btnImage, btnImageReset, btnApply, btnRevert, btnDelete, btnDuplicate })
                c.Enabled = on;
        }

        void LoadFields()
        {
            loadingFields = true;
            try
            {
                var e = selected;
                if (e == null)
                {
                    SetEditorEnabled(false); pic.Image = null; lblImgInfo.Text = ""; lblState.Text = "Sélectionnez un engin dans la liste."; lblState.ForeColor = Color.Black;
                    foreach (var t in new[] { txtName, txtSeries, txtCountry, txtOperator, txtNotes, txtId, txtSource }) t.Text = "";
                    lblTonnage.Text = ""; lblPriceCalc.Text = "";
                    return;
                }
                SetEditorEnabled(true);
                txtName.Text = e.Str("name");
                txtSeries.Text = e.Str("seriesName");
                int ci = Array.IndexOf(GameRules.Categories, e.Str("category")); cbEditCat.SelectedIndex = ci < 0 ? 0 : ci;
                cbEditTraction.Text = e.Str("traction").Length > 0 ? e.Str("traction") : "none";
                SetNum(nSpeed, e.Num("maxSpeed")); SetNum(nPower, e.Num("power")); SetNum(nLength, e.Num("length")); SetNum(nMass, e.Num("mass"));
                SetNum(nCap, e.Num("passengerCapacity")); SetNum(nFreight, e.Num("freightCapacity"));
                double price = e.Num("purchasePrice");
                double calc = GameRules.Price(e.Str("category"), e.Num("power"), e.Num("passengerCapacity"), e.Num("freightCapacity"));
                chkAutoPrice.Checked = Math.Abs(price - calc) < 0.5 && price > 0;
                SetNum(nPrice, price);
                nPrice.Enabled = !chkAutoPrice.Checked;
                int si = Array.IndexOf(GameRules.WagonSubcats, e.Str("wagonSubCategory")); cbEditSubcat.SelectedIndex = si < 0 ? 0 : si;
                var cargo = new HashSet<string>(e.StrList("cargoTypes"), StringComparer.Ordinal);
                for (int i = 0; i < clbCargo.Items.Count; i++) clbCargo.SetItemChecked(i, cargo.Contains(((CargoItem)clbCargo.Items[i]).T.Type));
                txtCountry.Text = e.Str("identityCountry");
                txtOperator.Text = e.Str("identityOperator");
                txtNotes.Text = e.Str("notes");
                txtId.Text = e.Id;
                txtSource.Text = e.Str("_source") + (e.Str("realIdentitySeries").Length > 0 ? " · " + e.Str("realIdentitySeries") : "");
                btnImageReset.Enabled = !e.IsImport && e.Original != null;
                btnRevert.Enabled = !e.IsImport;
                btnDelete.Text = e.IsDeleted ? "Restaurer" : "Supprimer";
                OnCategoryChanged();
                Recompute();
                ShowImage(e.Str("imageData"));
                fieldsDirty = false; btnApply.Enabled = false;
                UpdateStateLabel();
            }
            finally { loadingFields = false; }
        }

        static void SetNum(NumericUpDown n, double v)
        {
            decimal d = (decimal)Math.Max((double)n.Minimum, Math.Min((double)n.Maximum, double.IsNaN(v) ? 0 : v));
            n.Value = d;
        }

        void UpdateStateLabel()
        {
            var e = selected; if (e == null) return;
            string st = e.IsDeleted ? "SUPPRIMÉ du catalogue (sera retiré dans le jeu)" : e.IsImport ? "NOUVEL ENGIN (ajout au catalogue)" : e.IsModified ? "MODIFIÉ par rapport au catalogue du jeu" : "Fiche d'origine du jeu";
            if (fieldsDirty) st += " — changements non enregistrés";
            lblState.Text = st;
            lblState.ForeColor = e.IsDeleted ? Color.Gray : e.IsImport ? Color.FromArgb(0, 110, 0) : (e.IsModified || fieldsDirty) ? Color.FromArgb(0, 70, 170) : Color.Black;
        }

        void OnCategoryChanged()
        {
            bool wagon = cbEditCat.SelectedIndex == 3;
            pnlSubcat.Visible = wagon; pnlCargo.Visible = wagon;
            bool powered = cbEditCat.SelectedIndex <= 1;
            nPower.Enabled = powered;
            if (!loadingFields && !powered) { nPower.Value = 0; cbEditTraction.Text = "none"; }
        }

        void Recompute()
        {
            string cat = GameRules.Categories[Math.Max(0, cbEditCat.SelectedIndex)];
            double ton = GameRules.Tonnage(cat, (double)nMass.Value, (double)nFreight.Value);
            lblTonnage.Text = ton.ToString("0.#", Fr) + " t";
            double calc = GameRules.Price(cat, (double)nPower.Value, (double)nCap.Value, (double)nFreight.Value);
            lblPriceCalc.Text = "règle du jeu : " + calc.ToString("N0", Fr) + " €";
            if (chkAutoPrice.Checked) { loadingFields = true; try { SetNum(nPrice, calc); } finally { loadingFields = false; } }
        }

        void ApplyFields()
        {
            var e = selected; if (e == null) return;
            string name = txtName.Text.Trim();
            if (name.Length == 0) { MessageBox.Show(this, "Le nom de l'engin est obligatoire.", "Fiche incomplète", MessageBoxButtons.OK, MessageBoxIcon.Warning); txtName.Focus(); return; }
            string cat = GameRules.Categories[Math.Max(0, cbEditCat.SelectedIndex)];
            e.Current["name"] = name;
            e.Current["seriesName"] = txtSeries.Text.Trim();
            e.Current["category"] = cat;
            string tr = cbEditTraction.Text.Trim(); if (tr.Length == 0) tr = "none";
            e.Current["traction"] = (cat == "voiture" || cat == "wagon") ? "none" : tr;
            e.Current["maxSpeed"] = (double)nSpeed.Value;
            e.Current["power"] = (cat == "locomotive" || cat == "automotrice") ? (double)nPower.Value : 0.0;
            e.Current["length"] = (double)nLength.Value;
            e.Current["mass"] = (double)nMass.Value;
            e.Current["passengerCapacity"] = (double)nCap.Value;
            e.Current["freightCapacity"] = (double)nFreight.Value;
            e.Current["tonnage"] = GameRules.Tonnage(cat, (double)nMass.Value, (double)nFreight.Value);
            e.Current["purchasePrice"] = (double)nPrice.Value;
            e.Current["wagonSubCategory"] = cat == "wagon" ? GameRules.WagonSubcats[Math.Max(0, cbEditSubcat.SelectedIndex)] : "";
            var cargo = new List<object>();
            if (cat == "wagon") foreach (object o in clbCargo.CheckedItems) cargo.Add(((CargoItem)o).T.Type);
            e.Current["cargoTypes"] = cargo;
            e.Current["identityCountry"] = txtCountry.Text.Trim();
            e.Current["identityOperator"] = txtOperator.Text.Trim();
            if (txtNotes.Text.Trim().Length > 0 || e.Current.ContainsKey("notes")) e.Current["notes"] = txtNotes.Text.Trim();
            if (pendingImage != null) { e.Current["imageData"] = pendingImage; pendingImage = null; }
            fieldsDirty = false; btnApply.Enabled = false;
            store.Dirty = true;
            UpdateStateLabel(); RefreshView();
            UpdateStatus("Fiche « " + name + " » enregistrée dans le catalogue externe (pensez à Fichier → Enregistrer).");
        }

        void RevertEntry()
        {
            var e = selected; if (e == null || e.IsImport) return;
            e.Revert(); e.IsDeleted = false; pendingImage = null; store.Dirty = true;
            fieldsDirty = false; LoadFields(); RefreshView();
        }

        void DeleteEntry()
        {
            var e = selected; if (e == null) return;
            if (e.IsImport)
            {
                if (MessageBox.Show(this, "Supprimer définitivement le nouvel engin « " + e.Str("name") + " » ?", "Supprimer", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
                store.Remove(e); selected = null; fieldsDirty = false; LoadFields(); RefreshView(); return;
            }
            e.IsDeleted = !e.IsDeleted; store.Dirty = true;
            fieldsDirty = false; LoadFields(); RefreshView();
        }

        void NewEntry()
        {
            if (selected != null && fieldsDirty && !ConfirmDiscardFields()) return;
            var d = new Dictionary<string, object>();
            d["name"] = "Nouvel engin"; d["category"] = "locomotive"; d["traction"] = "diesel";
            d["maxSpeed"] = 160.0; d["power"] = 0.0; d["length"] = 20.0; d["mass"] = 80.0;
            d["passengerCapacity"] = 0.0; d["freightCapacity"] = 0.0; d["purchasePrice"] = 0.0;
            d["cargoTypes"] = new List<object>(); d["seriesName"] = ""; d["imageData"] = "";
            var e = store.AddImport(d);
            selected = e; fieldsDirty = false; ClearFiltersForNew(); RefreshView(); LoadFields(); txtName.Focus(); txtName.SelectAll();
        }

        void DuplicateEntry()
        {
            var src = selected; if (src == null) return;
            if (fieldsDirty && !ConfirmDiscardFields()) return;
            var d = new Dictionary<string, object>();
            foreach (string k in Entry.EditableKeys) { object v; if (src.Current.TryGetValue(k, out v)) d[k] = v is List<object> ? new List<object>((List<object>)v) : v; }
            d["name"] = src.Str("name") + " (copie)";
            var e = store.AddImport(d);
            selected = e; fieldsDirty = false; ClearFiltersForNew(); RefreshView(); LoadFields();
        }

        void ClearFiltersForNew()
        {
            loadingFields = true;
            try { txtSearch.Text = ""; cbCat.SelectedIndex = 0; cbTraction.SelectedIndex = 0; cbCountry.SelectedIndex = 0; cbOperator.SelectedIndex = 0; cbState.SelectedIndex = 2; }
            finally { loadingFields = false; }
        }

        // ================================================================ images
        string pendingImage;

        string ResolveImageDir()
        {
            var candidates = new List<string>();
            candidates.Add(Path.Combine(Program.AppDir, store.ImageRoot.Replace('/', Path.DirectorySeparatorChar)));
            candidates.Add(Path.Combine(Path.GetDirectoryName(Program.AppDir.TrimEnd(Path.DirectorySeparatorChar)) ?? Program.AppDir, store.ImageRoot.Replace('/', Path.DirectorySeparatorChar)));
            if (!string.IsNullOrEmpty(gameDir)) candidates.Add(Path.Combine(gameDir, store.ImageRoot.Replace('/', Path.DirectorySeparatorChar)));
            foreach (string c in candidates) if (Directory.Exists(c)) return c;
            return null;
        }

        void ShowImage(string imageData)
        {
            pic.Image = null; lblImgInfo.Text = "";
            if (string.IsNullOrEmpty(imageData)) { lblImgInfo.Text = "Aucune image"; return; }
            try
            {
                if (imageData.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    int comma = imageData.IndexOf(',');
                    byte[] bytes = Convert.FromBase64String(imageData.Substring(comma + 1));
                    var ms = new MemoryStream(bytes);
                    pic.Image = Image.FromStream(ms);
                    lblImgInfo.Text = "Image embarquée (" + (bytes.Length / 1024) + " Ko)";
                    return;
                }
                Image cached;
                if (imageCache.TryGetValue(imageData, out cached)) { pic.Image = cached; lblImgInfo.Text = Path.GetFileName(imageData); return; }
                string dir = ResolveImageDir();
                if (dir == null) { lblImgInfo.Text = "Dossier img/catalog introuvable (menu Fichier)"; return; }
                string rel = imageData;
                if (rel.StartsWith(store.ImageRoot + "/", StringComparison.OrdinalIgnoreCase)) rel = rel.Substring(store.ImageRoot.Length + 1);
                string full = Path.Combine(dir, rel.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(full)) { lblImgInfo.Text = "Image absente : " + rel; return; }
                using (var fs = File.OpenRead(full)) { var img = Image.FromStream(fs); pic.Image = img; if (imageCache.Count > 300) { foreach (var im in imageCache.Values) im.Dispose(); imageCache.Clear(); } imageCache[imageData] = img; }
                lblImgInfo.Text = Path.GetFileName(full) + " (" + pic.Image.Width + "×" + pic.Image.Height + ")";
            }
            catch (Exception ex) { lblImgInfo.Text = "Image illisible : " + ex.Message; }
        }

        void ChooseImage()
        {
            if (selected == null) return;
            using (var dlg = new OpenFileDialog { Title = "Image de l'engin", Filter = "Images (*.png;*.gif;*.jpg;*.jpeg;*.bmp;*.webp)|*.png;*.gif;*.jpg;*.jpeg;*.bmp;*.webp|Tous les fichiers|*.*" })
            {
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                byte[] bytes = File.ReadAllBytes(dlg.FileName);
                if (bytes.Length > 4 * 1024 * 1024 && MessageBox.Show(this, "Cette image fait " + (bytes.Length / 1048576) + " Mo : elle sera embarquée telle quelle dans le catalogue externe. Continuer ?", "Image volumineuse", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
                string ext = Path.GetExtension(dlg.FileName).ToLowerInvariant();
                string mime = ext == ".png" ? "image/png" : ext == ".gif" ? "image/gif" : (ext == ".jpg" || ext == ".jpeg") ? "image/jpeg" : ext == ".bmp" ? "image/bmp" : ext == ".webp" ? "image/webp" : "application/octet-stream";
                pendingImage = "data:" + mime + ";base64," + Convert.ToBase64String(bytes);
                ShowImage(pendingImage);
                MarkFieldChange();
            }
        }

        void ResetImage()
        {
            var e = selected; if (e == null || e.Original == null) return;
            object v; string orig = e.Original.TryGetValue("imageData", out v) && v != null ? v.ToString() : "";
            pendingImage = orig; ShowImage(orig); MarkFieldChange();
        }

        void ChooseGameDir()
        {
            using (var dlg = new FolderBrowserDialog { Description = "Sélectionnez le dossier de Rail Empire (celui qui contient index.html et img\\catalog)", ShowNewFolderButton = false })
            {
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                if (!Directory.Exists(Path.Combine(dlg.SelectedPath, Path.Combine("img", "catalog"))))
                {
                    MessageBox.Show(this, "Ce dossier ne contient pas img\\catalog.", "Dossier du jeu", MessageBoxButtons.OK, MessageBoxIcon.Warning); return;
                }
                gameDir = dlg.SelectedPath; Program.SaveSetting("gameDir", gameDir);
                imageCache.Clear();
                if (selected != null) ShowImage(selected.Str("imageData"));
                UpdateStatus("Dossier du jeu : " + gameDir);
            }
        }

        // ================================================================ fichier externe
        void OpenBundle()
        {
            if (store.Dirty && MessageBox.Show(this, "Les changements en cours non enregistrés seront perdus. Continuer ?", "Ouvrir", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            using (var dlg = new OpenFileDialog { Title = "Ouvrir un catalogue externe Rail Empire", Filter = "Catalogue Rail Empire (*.json)|*.json|Tous les fichiers|*.*" })
            {
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    store.ResetOverlay();
                    var r = store.LoadBundle(dlg.FileName);
                    selected = null; fieldsDirty = false; LoadFields(); RefreshView();
                    UpdateStatus("Catalogue externe chargé : " + r.Modified + " modif., " + r.Deleted + " suppr., " + r.Imported + " ajout(s)" + (r.Skipped > 0 ? ", " + r.Skipped + " ignoré(s)" : ""));
                }
                catch (Exception ex) { MessageBox.Show(this, ex.Message, "Fichier invalide", MessageBoxButtons.OK, MessageBoxIcon.Error); }
            }
        }

        bool SaveBundle(bool saveAs)
        {
            if (fieldsDirty && !ConfirmDiscardFields()) return false;
            string path = store.BundlePath;
            if (saveAs || string.IsNullOrEmpty(path))
            {
                using (var dlg = new SaveFileDialog { Title = "Enregistrer le catalogue externe", Filter = "Catalogue Rail Empire (*.json)|*.json", FileName = "rail-empire-catalogue.json" })
                {
                    if (dlg.ShowDialog(this) != DialogResult.OK) return false;
                    path = dlg.FileName;
                }
            }
            try
            {
                store.SaveBundle(path);
                UpdateStatus("Enregistré : " + path + " — importez-le dans le jeu (Matériel roulant → Importer un catalogue).");
                UpdateOverlayLabel();
                return true;
            }
            catch (Exception ex) { MessageBox.Show(this, ex.Message, "Enregistrement impossible", MessageBoxButtons.OK, MessageBoxIcon.Error); return false; }
        }

        void ResetOverlay()
        {
            if (MessageBox.Show(this, "Annuler toutes les modifications, suppressions et ajouts pour repartir du catalogue d'origine du jeu ?", "Repartir de zéro", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
            store.ResetOverlay(); selected = null; fieldsDirty = false; LoadFields(); RefreshView();
            UpdateStatus("Catalogue d'origine restauré.");
        }

        void UpdateOverlayLabel()
        {
            stOverlay.Text = store.CountModified() + " modifié(s) · " + store.CountImports() + " ajouté(s) · " + store.CountDeleted() + " supprimé(s)" + (store.Dirty ? " · non enregistré" : "") + (string.IsNullOrEmpty(store.BundlePath) ? "" : " · " + Path.GetFileName(store.BundlePath));
        }

        void UpdateStatus(string msg) { stMsg.Text = msg; }

        void OnClosing(object s, FormClosingEventArgs e)
        {
            if (fieldsDirty || store.Dirty)
            {
                var r = MessageBox.Show(this, "Des changements ne sont pas enregistrés dans un catalogue externe.\nEnregistrer avant de quitter ?", "Quitter", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
                if (r == DialogResult.Cancel) { e.Cancel = true; return; }
                if (r == DialogResult.Yes && !SaveBundle(false)) { e.Cancel = true; return; }
            }
        }
    }
}
