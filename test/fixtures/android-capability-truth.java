import java.util.*;

public class AndroidCapabilityTruthTest {
    static class JSONObject {
        final Map<String,Object> values=new HashMap<>();
        JSONObject put(String key,Object value){values.put(key,value);return this;}
        JSONObject getJSONObject(String key){return (JSONObject)Objects.requireNonNull(values.get(key),key);}
        boolean getBoolean(String key){return (Boolean)Objects.requireNonNull(values.get(key),key);}
    }
    static class PackageManager {static final int PERMISSION_GRANTED=0;}
    static class ComponentName {ComponentName(Context c,Class<?> type){}}
    static class DevicePolicyManager {
        final Context context;DevicePolicyManager(Context c){context=c;}
        boolean isDeviceOwnerApp(String name){return context.privileged;}
        boolean isAdminActive(ComponentName name){return context.privileged;}
    }
    static class AccessibilityManager {}
    static class Context {
        static final String DEVICE_POLICY_SERVICE="admin",ACCESSIBILITY_SERVICE="accessibility",MEDIA_PROJECTION_SERVICE="projection";
        final boolean privileged;boolean rootPolicy;
        Context(boolean value){privileged=value;rootPolicy=value;}
        PackageManager getPackageManager(){return new PackageManager();}
        String getPackageName(){return "org.roomgoblin.display";}
        int checkSelfPermission(String name){return privileged?0:-1;}
        Object getSystemService(String name){if(name.equals(DEVICE_POLICY_SERVICE))return new DevicePolicyManager(this);if(name.equals(ACCESSIBILITY_SERVICE))return new AccessibilityManager();return new Object();}
    }
    static class Manifest {static class permission {static final String POST_NOTIFICATIONS="notifications";}}
    static class Build {static class VERSION {static final int SDK_INT=35;}static final String MANUFACTURER="Fixture",MODEL="Fixture",DEVICE="Fixture",PRODUCT="Fixture",FINGERPRINT="Fixture";}
    static class BuildConfig {static final String VERSION_NAME="fixture";}
    static class Settings {static boolean canDrawOverlays(Context c){return c.privileged;}static class System {static boolean canWrite(Context c){return c.privileged;}}}
    static class AgentDeviceAdminReceiver {}
    static class AgentAccessibilityService {static boolean isEnabled(Context c){return c.privileged;}}
    static class RootTools {static boolean detected;static boolean binaryDetected(){return detected;}}
    static class Prefs {final Context context;Prefs(Context c){context=c;}boolean getBoolean(String key,boolean fallback){return context.rootPolicy;}}
    static class HubStorage {static Prefs prefs(Context c){return new Prefs(c);}}
    static class NativeSendspinManager {static final NativeSendspinManager INSTANCE=new NativeSendspinManager();JSONObject status(Context c){return new JSONObject();}}
/* CAPABILITY_SOURCE */
    static boolean available(JSONObject caps,String key){return caps.getJSONObject(key).getBoolean("available");}
    static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
    interface Case {void run();}
    static int passed,failed;
    static void run(String name,Case task){try{task.run();passed++;java.lang.System.out.println("PASS "+name);}catch(Throwable error){failed++;java.lang.System.err.println("FAIL "+name+": "+error.getMessage());}}
    public static void main(String[] args){
        String[] unsupported={"lockTaskKiosk","launchOtherApps","installedAppInventory","ownDisplaySnapshot","silentApkInstall","interactiveApkInstall","selfUpdate","powerOff","systemSettingsWrite"};
        for(boolean privileged:new boolean[]{false,true}){
            Context context=new Context(privileged);RootTools.detected=privileged;
            JSONObject caps=AgentCapabilities.snapshot(context).getJSONObject("capabilities");
            for(String key:unsupported)run(key+" remains unavailable with grants="+privileged,()->check(!available(caps,key),"Unimplemented operation advertised as available"));
            run("implemented controls retain their permission gates with grants="+privileged,()->{
                check(available(caps,"agentHttpApi")&&available(caps,"displayLaunch")&&available(caps,"volumeControl"),"Implemented stock action hidden");
                for(String key:new String[]{"sleepDisplay","reboot","persistentAdbSettings","navigationHome","remoteShell"})check(available(caps,key)==privileged,"Permission gate changed for "+key);
            });
        }
        for(boolean policy:new boolean[]{false,true})run("root requires binary and policy, policy="+policy,()->{
            Context context=new Context(false);context.rootPolicy=policy;RootTools.detected=!policy;
            check(!available(AgentCapabilities.snapshot(context).getJSONObject("capabilities"),"remoteShell"),"Root boundary weakened");
        });
        java.lang.System.out.println("Android capability truth: "+passed+" passed, "+failed+" failed, 0 skipped");
        if(failed!=0)java.lang.System.exit(1);
    }
}
