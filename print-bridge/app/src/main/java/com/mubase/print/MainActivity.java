package com.mubase.print;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * MUBASE Print - Passerelle d'impression pour Citaq H10-3.
 *
 * Ecoute sur http://127.0.0.1:8090 :
 *   POST /print  -> corps = texte brut du ticket -> envoi ESC/POS sur /dev/ttyS1
 *   GET  /       -> "MUBASE Print OK" (diagnostic)
 *   GET  /status -> etat de l'imprimante
 *
 * L'interface propose un bouton "TEST IMPRESSION" pour verifier
 * l'acces au port serie sans passer par la PWA.
 */
public class MainActivity extends Activity {

    private static final int PORT = 8090;
    private static final String PRINTER_DEVICE = "/dev/ttyS1";
    private static final int PRINTER_BAUD = 115200;

    private TextView statusView;
    private TextView logView;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile String lastError = "";
    private volatile int printCount = 0;
    private ServerSocket server;
    private Thread serverThread;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(Color.rgb(13, 17, 23));

        TextView title = new TextView(this);
        title.setText("MUBASE Print");
        title.setTextColor(Color.rgb(240, 165, 0));
        title.setTextSize(26);
        title.setGravity(android.view.Gravity.CENTER);
        root.addView(title);

        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(16);
        statusView.setPadding(0, dp(10), 0, dp(10));
        root.addView(statusView);

        Button testBtn = new Button(this);
        testBtn.setText("TEST IMPRESSION");
        testBtn.setTextSize(18);
        testBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { doTestPrint(); }
        });
        root.addView(testBtn);

        TextView hint = new TextView(this);
        hint.setText("Laissez cette application ouverte.\n" +
                "Elle reçoit les impressions de MUBASE POS\n" +
                "sur http://127.0.0.1:" + PORT);
        hint.setTextColor(Color.LTGRAY);
        hint.setTextSize(14);
        hint.setPadding(0, dp(16), 0, dp(16));
        root.addView(hint);

        ScrollView scroll = new ScrollView(this);
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
        scroll.setLayoutParams(slp);
        logView = new TextView(this);
        logView.setTextColor(Color.GREEN);
        logView.setTextSize(12);
        logView.setTypeface(android.graphics.Typeface.MONOSPACE);
        scroll.addView(logView);
        root.addView(scroll);

        setContentView(root);
        startServer();
        refreshStatus();
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    /* ---------------- Serveur HTTP local ---------------- */

    private void startServer() {
        serverThread = new Thread(new Runnable() {
            @Override public void run() {
                try {
                    server = new ServerSocket(PORT);
                    log("Serveur d'impression demarre sur port " + PORT);
                    while (!server.isClosed()) {
                        try {
                            Socket s = server.accept();
                            handle(s);
                        } catch (Exception e) {
                            if (!server.isClosed()) log("Erreur connexion: " + e);
                        }
                    }
                } catch (Exception e) {
                    lastError = "Port " + PORT + " indisponible: " + e;
                    log(lastError);
                }
            }
        });
        serverThread.setDaemon(true);
        serverThread.start();
    }

    private void handle(Socket s) {
        try {
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(s.getInputStream(), "UTF-8"));
            String requestLine = reader.readLine();
            if (requestLine == null) { s.close(); return; }
            String[] parts = requestLine.split(" ");
            String method = parts.length > 0 ? parts[0] : "";
            String path = parts.length > 1 ? parts[1] : "/";

            int contentLength = 0;
            String line;
            while ((line = reader.readLine()) != null && line.length() > 0) {
                if (line.toLowerCase().startsWith("content-length:")) {
                    contentLength = Integer.parseInt(line.substring(15).trim());
                }
            }

            if ("POST".equals(method) && path.startsWith("/print")) {
                char[] buf = new char[contentLength];
                int read = 0;
                while (read < contentLength) {
                    int r = reader.read(buf, read, contentLength - read);
                    if (r < 0) break;
                    read += r;
                }
                String body = new String(buf, 0, read);
                boolean ok = printText(body);
                String resp = ok ? "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK"
                                 : "HTTP/1.1 500 ERR\r\nContent-Length: " +
                                   lastError.length() + "\r\n\r\n" + lastError;
                OutputStream out = s.getOutputStream();
                out.write(resp.getBytes("UTF-8"));
                out.flush();
            } else if ("GET".equals(method) && path.startsWith("/status")) {
                String body = "imprimante=" + (lastError.isEmpty() ? "OK" : "ERR:" + lastError)
                        + " impressions=" + printCount;
                String resp = "HTTP/1.1 200 OK\r\nContent-Length: " + body.length()
                        + "\r\nContent-Type: text/plain\r\n\r\n" + body;
                s.getOutputStream().write(resp.getBytes("UTF-8"));
            } else {
                String resp = "HTTP/1.1 200 OK\r\nContent-Length: 13\r\n\r\nMUBASE Print";
                s.getOutputStream().write(resp.getBytes("UTF-8"));
            }
            s.close();
        } catch (Exception e) {
            try { s.close(); } catch (Exception ignored) {}
        }
    }

    /* ---------------- Impression ESC/POS ---------------- */

    private boolean printText(String text) {
        try {
            byte[] data = buildEscPos(text);
            writeSerial(data);
            printCount++;
            log("Impression #" + printCount + " envoyee (" + data.length + " octets)");
            return true;
        } catch (Exception e) {
            lastError = e.getMessage() != null ? e.getMessage() : String.valueOf(e);
            log("ERREUR impression: " + lastError);
            return false;
        }
    }

    private byte[] buildEscPos(String text) throws Exception {
        StringBuilder sb = new StringBuilder();
        sb.append(text);
        // Initialisation imprimante + saut de ligne + coupe
        byte[] init = new byte[]{0x1B, 0x40};       // ESC @ init
        byte[] feed = new byte[]{0x0A, 0x0A, 0x0A}; // sauts de ligne
        byte[] cut = new byte[]{0x1D, 0x56, 0x00};   // GS V coupe partielle
        byte[] body = sanitize(sb.toString()).getBytes("UTF-8");
        byte[] out = new byte[init.length + body.length + feed.length + cut.length];
        System.arraycopy(init, 0, out, 0, init.length);
        System.arraycopy(body, 0, out, init.length, body.length);
        System.arraycopy(feed, 0, out, init.length + body.length, feed.length);
        System.arraycopy(cut, 0, out, init.length + body.length + feed.length, cut.length);
        return out;
    }

    // Remplace les accents francais par des caracteres ASCII
    // (l'imprimante CTE-RP80 en page de code par defaut ne les gere pas)
    private String sanitize(String s) {
        return s
                .replace('à', 'a').replace('â', 'a').replace('ä', 'a')
                .replace('é', 'e').replace('è', 'e').replace('ê', 'e').replace('ë', 'e')
                .replace('î', 'i').replace('ï', 'i')
                .replace('ô', 'o').replace('ö', 'o')
                .replace('ù', 'u').replace('û', 'u').replace('ü', 'u')
                .replace('ç', 'c')
                .replace('À', 'A').replace('Â', 'A').replace('Ä', 'A')
                .replace('É', 'E').replace('È', 'E').replace('Ê', 'E').replace('Ë', 'E')
                .replace('Î', 'I').replace('Ï', 'I')
                .replace('Ô', 'O').replace('Ö', 'O')
                .replace('Ù', 'U').replace('Û', 'U').replace('Ü', 'U')
                .replace('Ç', 'C')
                .replace('’', '\'').replace('‘', '\'')
                .replace('“', '"').replace('”', '"')
                .replace('€', 'E').replace('°', 'o')
                .replace('…', '.');
    }

    private void writeSerial(byte[] data) throws Exception {
        // Configure le port serie (115200, 8N1, flux materiel) via stty si dispo
        try {
            Runtime.getRuntime().exec(new String[]{
                    "sh", "-c",
                    "stty -F " + PRINTER_DEVICE + " " + PRINTER_BAUD +
                    " cs8 -cstopb -parenb crtscts raw -echo"});
            Thread.sleep(150);
        } catch (Exception ignored) {}

        // Ecriture directe des octets ESC/POS
        FileOutputStream fos = new FileOutputStream(new File(PRINTER_DEVICE));
        try {
            fos.write(data);
            fos.flush();
        } finally {
            fos.close();
        }
    }

    /* ---------------- Test et interface ---------------- */

    private void doTestPrint() {
        String stamp = new SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.FRENCH)
                .format(new Date());
        String test = "========================================\n" +
                "     TEST IMPRESSION MUBASE POS\n" +
                "========================================\n" +
                "Imprimante CTE-RP80 /dev/ttyS1\n" +
                "Si ce ticket sort, tout est OK !\n" +
                "Date: " + stamp + "\n\n\n";
        new Thread(new Runnable() {
            @Override public void run() {
                boolean ok = printText(test);
                ui.post(new Runnable() {
                    @Override public void run() {
                        if (ok) log("Test OK : verifiez l'imprimante !");
                        else log("Test ECHEC : " + lastError);
                    }
                });
            }
        }).start();
    }

    private void log(final String msg) {
        ui.post(new Runnable() {
            @Override public void run() {
                logView.append(msg + "\n");
            }
        });
    }

    private void refreshStatus() {
        statusView.setText("En ecoute sur http://127.0.0.1:" + PORT +
                "\nImpressions envoyees: " + printCount +
                (lastError.isEmpty() ? "" : "\nDerniere erreur: " + lastError));
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override
    protected void onDestroy() {
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        super.onDestroy();
    }
}
