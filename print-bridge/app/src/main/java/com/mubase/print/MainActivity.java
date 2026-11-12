package com.mubase.print;

import android.app.Activity;
import android.content.Intent;
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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Interface de MUBASE Print : demarre le service persistant,
 * affiche l'etat et propose un test d'impression.
 */
public class MainActivity extends Activity {

    private TextView statusView;
    private TextView logView;
    private final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Demarre le service persistant (idempotent)
        startService(new Intent(this, PrintService.class));

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
        hint.setText("Le service reste actif en arriere-plan\n" +
                "(notification permanente + demarrage auto).\n" +
                "Vous pouvez fermer cette ecran.");
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
        // Rafraichit le statut periodiquement
        ui.postDelayed(new Runnable() {
            @Override public void run() { refreshStatus(); schedule(); }
        }, 500);
    }

    private void schedule() {
        ui.postDelayed(new Runnable() {
            @Override public void run() { refreshStatus(); schedule(); }
        }, 2000);
    }

    private int dp(int v) {
        return (int) (v * getResources().getDisplayMetrics().density);
    }

    private void refreshStatus() {
        statusView.setText("Service: " + (PrintService.running ? "ACTIF" : "arrete") +
                "\nEcoute sur http://127.0.0.1:" + PrintService.PORT +
                "\nImpressions envoyees: " + PrintService.printCount +
                (PrintService.lastError.isEmpty() ? "" :
                        "\nDerniere erreur: " + PrintService.lastError));
        logView.setText(PrintService.lastLog + "\n" + logView.getText().toString());
        // garde le log borne
        CharSequence t = logView.getText();
        if (t.length() > 2000) logView.setText(t.subSequence(t.length() - 2000, t.length()));
    }

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
                PrintService.printText(test);
            }
        }).start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }
}
