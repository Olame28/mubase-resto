package com.mubase.print;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;

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
 * Service permanent : ecoute http://127.0.0.1:8090 et envoie les
 * impressions a l'imprimante thermique /dev/ttyS1.
 * Demarre au boot et reste actif (notification persistante).
 */
public class PrintService extends Service {

    public static final int PORT = 8090;
    private static final String PRINTER_DEVICE = "/dev/ttyS1";
    private static final int PRINTER_BAUD = 115200;
    private static final int NOTIF_ID = 1;

    // Etat partage avec l'activite (lecture seule cote UI)
    public static volatile String lastError = "";
    public static volatile int printCount = 0;
    public static volatile boolean running = false;
    public static volatile String lastLog = "";

    private ServerSocket server;
    private Thread serverThread;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());
        startServer();
        return START_STICKY; // redemarrage auto si Android tue le service
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder nb = new Notification.Builder(this)
                .setContentTitle("MUBASE Print actif")
                .setContentText("Imprimante thermique prete - " + printCount + " impression(s)")
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setContentIntent(pi)
                .setOngoing(true);
        return nb.getNotification();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification());
    }

    private void startServer() {
        if (running) return;
        running = true;
        serverThread = new Thread(new Runnable() {
            @Override public void run() {
                try {
                    server = new ServerSocket(PORT);
                    addLog("Serveur demarre sur port " + PORT);
                    while (!server.isClosed()) {
                        try {
                            Socket s = server.accept();
                            handle(s);
                        } catch (Exception e) {
                            if (!server.isClosed()) addLog("Erreur connexion: " + e);
                        }
                    }
                } catch (Exception e) {
                    lastError = "Port " + PORT + " indisponible: " + e;
                    addLog(lastError);
                } finally {
                    running = false;
                }
            }
        });
        serverThread.setDaemon(true);
        serverThread.start();
    }

    private void addLog(final String msg) {
        lastLog = msg;
        android.util.Log.i("MUBASEPrint", msg);
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
                char[] buf = new char[Math.min(contentLength, 65536)];
                int read = 0;
                while (read < contentLength && read < buf.length) {
                    int r = reader.read(buf, read, contentLength - read);
                    if (r < 0) break;
                    read += r;
                }
                String body = new String(buf, 0, read);
                boolean ok = printText(body);
                String resp;
                if (ok) {
                    resp = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK";
                } else {
                    resp = "HTTP/1.1 500 ERR\r\nContent-Length: " + lastError.length()
                            + "\r\n\r\n" + lastError;
                }
                OutputStream out = s.getOutputStream();
                out.write(resp.getBytes("UTF-8"));
                out.flush();
            } else if ("GET".equals(method) && path.startsWith("/status")) {
                String body = "running=" + running + " impressions=" + printCount
                        + " erreur=" + lastError;
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

    public static boolean printText(String text) {
        try {
            byte[] data = buildEscPos(text);
            writeSerial(data);
            printCount++;
            lastError = "";
            lastLog = "Impression #" + printCount;
            return true;
        } catch (Exception e) {
            lastError = e.getMessage() != null ? e.getMessage() : String.valueOf(e);
            lastLog = "ERREUR: " + lastError;
            return false;
        }
    }

    private static byte[] buildEscPos(String text) throws Exception {
        byte[] init = new byte[]{0x1B, 0x40};
        byte[] feed = new byte[]{0x0A, 0x0A, 0x0A};
        byte[] cut = new byte[]{0x1D, 0x56, 0x00};
        byte[] body = sanitize(text).getBytes("UTF-8");
        byte[] out = new byte[init.length + body.length + feed.length + cut.length];
        System.arraycopy(init, 0, out, 0, init.length);
        System.arraycopy(body, 0, out, init.length, body.length);
        System.arraycopy(feed, 0, out, init.length + body.length, feed.length);
        System.arraycopy(cut, 0, out, init.length + body.length + feed.length, cut.length);
        return out;
    }

    private static String sanitize(String s) {
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

    private static void writeSerial(byte[] data) throws Exception {
        try {
            Runtime.getRuntime().exec(new String[]{
                    "sh", "-c",
                    "stty -F " + PRINTER_DEVICE + " " + PRINTER_BAUD +
                    " cs8 -cstopb -parenb crtscts raw -echo"});
            Thread.sleep(150);
        } catch (Exception ignored) {}

        FileOutputStream fos = new FileOutputStream(new File(PRINTER_DEVICE));
        try {
            fos.write(data);
            fos.flush();
        } finally {
            fos.close();
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        running = false;
        super.onDestroy();
    }
}
