using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace SnapAILauncher
{
    public class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        private Label lblBackendStatus;
        private Label lblFrontendStatus;
        private Button btnOpenBrowser;
        private Button btnStopExit;
        private System.Windows.Forms.Timer statusTimer;
        private string baseDir;

        public MainForm()
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            InitializeUI();
            StartServices();

            // Status checking timer
            statusTimer = new System.Windows.Forms.Timer();
            statusTimer.Interval = 2500;
            statusTimer.Tick += (s, e) => UpdatePortStatuses();
            statusTimer.Start();
        }

        private void InitializeUI()
        {
            this.Text = "SnapAI - Control Panel";
            this.Size = new Size(480, 310);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(15, 23, 42); // slate-900
            this.ForeColor = Color.FromArgb(241, 245, 249); // slate-100

            // Header Icon / Title
            Label lblTitle = new Label
            {
                Text = "⚡ SnapAI Launcher",
                Font = new Font("Segoe UI", 16, FontStyle.Bold),
                ForeColor = Color.White,
                Location = new Point(24, 20),
                AutoSize = true
            };
            this.Controls.Add(lblTitle);

            // Subtitle
            Label lblSub = new Label
            {
                Text = "Watermark-free Media Downloader & AI Upscaler",
                Font = new Font("Segoe UI", 9, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184), // slate-400
                Location = new Point(26, 52),
                AutoSize = true
            };
            this.Controls.Add(lblSub);

            // Status Card
            Panel panelCard = new Panel
            {
                Location = new Point(24, 85),
                Size = new Size(416, 85),
                BackColor = Color.FromArgb(30, 41, 59) // slate-800
            };
            this.Controls.Add(panelCard);

            lblBackendStatus = new Label
            {
                Text = "● Backend API: Checking...",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(16, 16),
                AutoSize = true
            };
            panelCard.Controls.Add(lblBackendStatus);

            lblFrontendStatus = new Label
            {
                Text = "● Frontend Web UI: Checking...",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(16, 46),
                AutoSize = true
            };
            panelCard.Controls.Add(lblFrontendStatus);

            // Button: Open Browser
            btnOpenBrowser = new Button
            {
                Text = "🌐 Open in Browser (http://localhost:5173)",
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                Location = new Point(24, 185),
                Size = new Size(280, 42),
                BackColor = Color.FromArgb(79, 70, 229), // indigo-600
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnOpenBrowser.FlatAppearance.BorderSize = 0;
            btnOpenBrowser.Click += (s, e) => OpenWeb();
            this.Controls.Add(btnOpenBrowser);

            // Button: Stop & Exit
            btnStopExit = new Button
            {
                Text = "🛑 Stop & Exit",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                Location = new Point(316, 185),
                Size = new Size(124, 42),
                BackColor = Color.FromArgb(51, 65, 85), // slate-700
                ForeColor = Color.FromArgb(248, 113, 113), // rose-400
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnStopExit.FlatAppearance.BorderSize = 0;
            btnStopExit.Click += (s, e) =>
            {
                StopAllServers();
                Application.Exit();
            };
            this.Controls.Add(btnStopExit);

            // Footer note
            Label lblFooter = new Label
            {
                Text = "Auto-opened in your default browser. Keep this window open while using.",
                Font = new Font("Segoe UI", 8, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139), // slate-500
                Location = new Point(26, 240),
                AutoSize = true
            };
            this.Controls.Add(lblFooter);
        }

        private bool IsPortListening(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    var result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(400);
                    if (success && client.Connected)
                    {
                        client.EndConnect(result);
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private void UpdatePortStatuses()
        {
            bool bOk = IsPortListening(5000);
            bool fOk = IsPortListening(5173);

            if (bOk)
            {
                lblBackendStatus.Text = "● Backend API: Running on http://localhost:5000";
                lblBackendStatus.ForeColor = Color.FromArgb(52, 211, 153); // emerald-400
            }
            else
            {
                lblBackendStatus.Text = "○ Backend API: Offline (Port 5000)";
                lblBackendStatus.ForeColor = Color.FromArgb(248, 113, 113); // rose-400
            }

            if (fOk)
            {
                lblFrontendStatus.Text = "● Frontend Web: Running on http://localhost:5173";
                lblFrontendStatus.ForeColor = Color.FromArgb(52, 211, 153); // emerald-400
            }
            else
            {
                lblFrontendStatus.Text = "○ Frontend Web: Offline (Port 5173)";
                lblFrontendStatus.ForeColor = Color.FromArgb(248, 113, 113); // rose-400
            }
        }

        private void StartServices()
        {
            new Thread(() =>
            {
                // 1. Check & start backend
                if (!IsPortListening(5000))
                {
                    string backendDir = Path.Combine(baseDir, "backend");
                    if (Directory.Exists(backendDir))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo
                        {
                            FileName = "cmd.exe",
                            Arguments = "/c node server.js",
                            WorkingDirectory = backendDir,
                            WindowStyle = ProcessWindowStyle.Hidden,
                            CreateNoWindow = true,
                            UseShellExecute = true
                        };
                        try { Process.Start(psi); } catch { }
                    }
                }

                // 2. Check & start frontend
                if (!IsPortListening(5173))
                {
                    string frontendDir = Path.Combine(baseDir, "frontend");
                    if (Directory.Exists(frontendDir))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo
                        {
                            FileName = "cmd.exe",
                            Arguments = "/c npm run dev",
                            WorkingDirectory = frontendDir,
                            WindowStyle = ProcessWindowStyle.Hidden,
                            CreateNoWindow = true,
                            UseShellExecute = true
                        };
                        try { Process.Start(psi); } catch { }
                    }
                }

                // Wait up to 5 seconds for frontend to become ready, then launch browser
                for (int i = 0; i < 10; i++)
                {
                    Thread.Sleep(500);
                    if (IsPortListening(5173)) break;
                }

                OpenWeb();

                // Refresh UI status
                this.Invoke((MethodInvoker)delegate { UpdatePortStatuses(); });
            })
            { IsBackground = true }.Start();
        }

        private void OpenWeb()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "http://localhost:5173",
                    UseShellExecute = true
                });
            }
            catch { }
        }

        private void StopAllServers()
        {
            try
            {
                // Execute port killer script or taskkill commands
                string stopScript = Path.Combine(baseDir, "stop.bat");
                if (File.Exists(stopScript))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = "/c \"" + stopScript + "\"",
                        WorkingDirectory = baseDir,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true,
                        UseShellExecute = true
                    };
                    var p = Process.Start(psi);
                    if (p != null) p.WaitForExit(3000);
                }
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (statusTimer != null)
            {
                statusTimer.Stop();
            }
            base.OnFormClosing(e);
        }
    }
}
