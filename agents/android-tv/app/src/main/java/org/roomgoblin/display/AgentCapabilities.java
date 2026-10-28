package org.roomgoblin.display;

import android.Manifest;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;

import org.json.JSONObject;

final class AgentCapabilities {
    private AgentCapabilities() {}

    private static JSONObject cap(boolean available,String mode,String detail) throws Exception {
        JSONObject o=new JSONObject();o.put("available",available);o.put("mode",mode);o.put("detail",detail);return o;
    }

    static JSONObject snapshot(Context context) {
        JSONObject root=new JSONObject();
        try {
            PackageManager pm=context.getPackageManager();
            DevicePolicyManager dpm=(DevicePolicyManager)context.getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName admin=new ComponentName(context,AgentDeviceAdminReceiver.class);
            AccessibilityManager accessibility=(AccessibilityManager)context.getSystemService(Context.ACCESSIBILITY_SERVICE);
            boolean deviceOwner=dpm!=null&&dpm.isDeviceOwnerApp(context.getPackageName());
            boolean adminActive=dpm!=null&&dpm.isAdminActive(admin);
            boolean secure=context.checkSelfPermission("android.permission.WRITE_SECURE_SETTINGS")==PackageManager.PERMISSION_GRANTED;
            boolean notify=Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
            boolean overlay=Settings.canDrawOverlays(context);
            boolean writeSettings=Settings.System.canWrite(context);
            boolean accessibilityEnabled=AgentAccessibilityService.isEnabled(context);
            boolean rootBinary=RootTools.binaryDetected();
            boolean rootPolicy=HubStorage.prefs(context).getBoolean("allow_root_tools",false);
            boolean rootCommandsAvailable=rootBinary&&rootPolicy;
            JSONObject sendspin=NativeSendspinManager.INSTANCE.status(context);

            root.put("agentVersion",BuildConfig.VERSION_NAME);root.put("sdk",Build.VERSION.SDK_INT);root.put("manufacturer",Build.MANUFACTURER);root.put("model",Build.MODEL);root.put("device",Build.DEVICE);root.put("product",Build.PRODUCT);root.put("fingerprint",Build.FINGERPRINT);
            root.put("deviceOwner",deviceOwner);root.put("deviceAdminActive",adminActive);root.put("writeSecureSettings",secure);root.put("notificationPermission",notify);root.put("overlayPermission",overlay);root.put("writeSystemSettings",writeSettings);root.put("accessibilityEnabled",accessibilityEnabled);root.put("rootBinaryDetected",rootBinary);root.put("rootPolicyEnabled",rootPolicy);root.put("sendspin",sendspin);

            JSONObject c=new JSONObject();
            c.put("bootAutoStart",cap(true,"native","BOOT_COMPLETED/LOCKED_BOOT_COMPLETED receiver"));
            c.put("foregroundManagement",cap(true,"native","specialUse/mediaPlayback foreground service"));
            c.put("kioskAlwaysOn",cap(true,"native","agent process holds an always-on display wake lock while managed"));
            c.put("kioskSelfHeal",cap(true,"native","process-level watchdog requests kiosk relaunch within 30 seconds after the display activity leaves foreground"));
            c.put("agentHttpApi",cap(true,"native","authenticated LAN HTTP control channel independent of external ADB"));
            c.put("displayLaunch",cap(true,"native","launch own kiosk activity; watchdog retries background recovery when OEM policy delays a launch"));
            c.put("displayReload",cap(true,"native","reload own WebView without restarting native audio"));
            c.put("deviceHeartbeat",cap(true,"native","agent status/capability endpoint"));
            c.put("networkInfo",cap(true,"native","ConnectivityManager and local interface data"));
            c.put("nativeSendspin",cap(true,"native","Sendspin JVM transport with Android AudioTrack output; initial validated format target is PCM 48 kHz stereo 16-bit"));
            c.put("volumeControl",cap(true,"native","AudioManager media volume"));
            c.put("wakeDisplay",cap(true,"native","wake lock plus kiosk launch"));
            c.put("sleepDisplay",cap(adminActive,"device-admin","requires active device-admin force-lock policy; normally disabled for always-on kiosk profiles"));
            c.put("reboot",cap(deviceOwner,"device-owner","the native reboot action requires DevicePolicyManager device-owner authority"));
            c.put("lockTaskKiosk",cap(false,"not-implemented","native lock-task provisioning is not implemented"));
            c.put("persistentAdbSettings",cap(secure,"adb-bootstrap","WRITE_SECURE_SETTINGS must be granted once through trusted ADB, local ADB, or device-owner provisioning"));
            c.put("localAdbPairing",cap(true,"experimental","first-party local ADB client supports explicit pairing-code enrollment"));
            c.put("wirelessAdbDiscovery",cap(true,"experimental","first-party local ADB client uses Android mDNS discovery through libadb-android"));
            c.put("legacyAdbPortSwitch",cap(true,"experimental","local ADB can request tcpip:<target-port>; actual firmware behavior is measured at runtime"));
            c.put("localAdbSelfGrant",cap(true,"experimental","paired local ADB can attempt pm grant WRITE_SECURE_SETTINGS to this agent"));
            c.put("remoteShell",cap(rootCommandsAvailable,"root-only","requires both a detected superuser binary and the explicit RoomGoblin root-tools policy"));
            c.put("rootProbe",cap(rootBinary,"experimental-root","explicit probe only; normal heartbeat never requests superuser"));

            // Keep the aggregate capability for backward compatibility, but expose each
            // global action separately so clients do not infer arbitrary input support.
            c.put("globalNavigation",cap(accessibilityEnabled,"accessibility","Accessibility global actions are enabled; individual actions may still be limited by OEM firmware"));
            c.put("navigationHome",cap(accessibilityEnabled,"accessibility","GLOBAL_ACTION_HOME through the RoomGoblin Accessibility service"));
            c.put("navigationBack",cap(accessibilityEnabled,"accessibility","GLOBAL_ACTION_BACK through the RoomGoblin Accessibility service"));
            c.put("navigationRecents",cap(accessibilityEnabled,"accessibility-oem","GLOBAL_ACTION_RECENTS request is available when Accessibility is enabled, but the OEM launcher may ignore it or expose no Recents UI"));

            c.put("launchOtherApps",cap(false,"not-implemented","native app launching is not implemented; trusted Hub ADB launch remains available"));
            c.put("installedAppInventory",cap(false,"not-implemented","native installed-app inventory is not implemented"));
            c.put("screenCapture",cap(false,"user-consent","full-screen capture requires MediaProjection consent; ADB/root may offer unattended alternatives"));
            c.put("ownDisplaySnapshot",cap(false,"planned","own-WebView snapshot capture is not implemented"));
            c.put("silentApkInstall",cap(false,"not-implemented","native unattended APK installation is not implemented; trusted Hub ADB installation remains available"));
            c.put("interactiveApkInstall",cap(false,"not-implemented","native user-confirmed APK installation is not implemented"));
            c.put("selfUpdate",cap(false,"not-implemented","native self-update is not implemented; the Hub manages verified APK installation"));
            c.put("powerOff",cap(false,"not-implemented","the native action API has no power-off operation"));
            c.put("inputInjection",cap(false,"not-implemented","Agent v2 does not implement arbitrary key, text, tap, swipe, or coordinate injection; Accessibility provides supported global actions only"));
            c.put("systemSettingsWrite",cap(false,"not-implemented","generic settings writes are not implemented; persistentAdbSettings describes the supported ADB recovery action"));
            c.put("overlay",cap(overlay,"user-grant","SYSTEM_ALERT_WINDOW requires explicit approval"));
            c.put("deviceAdmin",cap(adminActive,"user-grant","legacy device-admin can lock but is not equivalent to device owner"));
            c.put("deviceOwnerProvisioning",cap(deviceOwner,"provisioning","normally requires provisioning/factory-reset workflow on consumer Android TV"));
            c.put("mediaProjectionApi",cap(context.getSystemService(Context.MEDIA_PROJECTION_SERVICE)!=null,"user-consent","API present but each capture session requires platform-granted consent"));
            c.put("accessibilityApi",cap(accessibility!=null,"user-grant","service must be explicitly enabled unless provisioned by management tooling"));
            root.put("capabilities",c);
        } catch(Exception e) {try {root.put("probeError",String.valueOf(e));}catch(Exception ignored){}}
        return root;
    }
}
