package com.mubase.print;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Redemarre le service d'impression au boot du terminal. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Intent svc = new Intent(context, PrintService.class);
            context.startService(svc);
        }
    }
}
