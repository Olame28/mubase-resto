package com.mubase.pos;

import java.io.File;
import java.io.FileOutputStream;

/** Envoi ESC/POS direct sur l'imprimante thermique /dev/ttyS1 (Citaq H10-3). */
public class Printer {

    private static final String DEVICE = "/dev/ttyS1";
    private static final int BAUD = 115200;

    /**
     * Imprime un ticket texte.
     * @return true si l'ecriture a reussi, false sinon (message dans lastError)
     */
    public static boolean printText(String text) {
        try {
            byte[] data = buildEscPos(text);
            writeSerial(data);
            return true;
        } catch (Exception e) {
            lastError = e.getMessage() != null ? e.getMessage() : String.valueOf(e);
            return false;
        }
    }

    public static String lastError = "";

    private static byte[] buildEscPos(String text) throws Exception {
        byte[] init = new byte[]{0x1B, 0x40};       // ESC @ init
        byte[] feed = new byte[]{0x0A, 0x0A, 0x0A}; // sauts de ligne
        byte[] cut = new byte[]{0x1D, 0x56, 0x00};   // GS V coupe partielle
        byte[] body = sanitize(text).getBytes("UTF-8");
        byte[] out = new byte[init.length + body.length + feed.length + cut.length];
        System.arraycopy(init, 0, out, 0, init.length);
        System.arraycopy(body, 0, out, init.length, body.length);
        System.arraycopy(feed, 0, out, init.length + body.length, feed.length);
        System.arraycopy(cut, 0, out, init.length + body.length + feed.length, cut.length);
        return out;
    }

    // Accents francais -> ASCII (page de code imprimante)
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
                    "stty -F " + DEVICE + " " + BAUD +
                    " cs8 -cstopb -parenb crtscts raw -echo"});
            Thread.sleep(150);
        } catch (Exception ignored) {}

        FileOutputStream fos = new FileOutputStream(new File(DEVICE));
        try {
            fos.write(data);
            fos.flush();
        } finally {
            fos.close();
        }
    }
}
