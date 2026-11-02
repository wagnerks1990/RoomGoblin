public class ActivityAssignmentTest {
 static class Intent { boolean reload; Intent(boolean value){reload=value;} boolean getBooleanExtra(String key,boolean fallback){return reload;} }
 static class Base { protected void onNewIntent(Intent intent){} void setIntent(Intent intent){} }
 static class Prefs {String url; String getString(String key,String fallback){return url;} }
 static class HubStorage {static Prefs prefs(Object context){return ((Harness)context).prefs;} }
 static class WebView {String current;int loads,reloads;String getUrl(){return current;}void loadUrl(String url){current=url;loads++;}void loadData(String data,String mime,String encoding){current="about:blank";loads++;}void reload(){reloads++;}}
 static class Harness extends Base {
  final Prefs prefs=new Prefs();private static final String EXTRA_RELOAD="agent_reload";
/* ACTIVITY_FIELDS */
  Harness(String url){prefs.url=url;webView=new WebView();loadConfiguredUrl();}
  void enterImmersive(){}
/* ACTIVITY_INTENT */
/* ACTIVITY_LOADER */
 }
 interface Case {void run();}
 static void check(boolean ok){if(!ok)throw new AssertionError("Configured assignment or persistent session was not preserved");}
 public static void main(String[] args){
 String old="http://fixture.invalid/display/one",next="http://fixture.invalid/display/two";
 String[] names={"initial configured URL loads once","new assignment reaches running WebView","placeholder accepts its first assignment","same configuration preserves redirected live session","explicit reload preserves current assignment","reload after reassignment loads only the new assignment","missing WebView URL recovers configured assignment"};
 Case[] cases={
 ()->{Harness h=new Harness(old);h.ensureConfiguredUrlLoaded();check(h.webView.loads==1&&old.equals(h.webView.current));},
 ()->{Harness h=new Harness(old);h.prefs.url=next;h.onNewIntent(new Intent(false));check(h.webView.loads==2&&next.equals(h.webView.current));},
 ()->{Harness h=new Harness("");h.prefs.url=next;h.onNewIntent(new Intent(false));check(h.webView.loads==2&&next.equals(h.webView.current));},
 ()->{Harness h=new Harness(old);h.webView.current="https://redirect.invalid/display/one";h.ensureConfiguredUrlLoaded();check(h.webView.loads==1&&h.webView.current.contains("redirect.invalid"));},
 ()->{Harness h=new Harness(old);h.onNewIntent(new Intent(true));check(h.webView.loads==1&&h.webView.reloads==1);},
 ()->{Harness h=new Harness(old);h.prefs.url=next;h.onNewIntent(new Intent(true));check(h.webView.loads==2&&next.equals(h.webView.current)&&h.webView.reloads==0);},
 ()->{Harness h=new Harness(old);h.webView.current=null;h.ensureConfiguredUrlLoaded();check(h.webView.loads==2&&old.equals(h.webView.current));}
 };
 int failed=0;for(int i=0;i<cases.length;i++)try{cases[i].run();System.out.println("PASS "+names[i]);}catch(Throwable error){failed++;System.err.println("FAIL "+names[i]+": "+error.getMessage());}
 System.out.println("Android activity assignment: "+(cases.length-failed)+" passed, "+failed+" failed, 0 skipped");if(failed!=0)System.exit(1);
 }
}
