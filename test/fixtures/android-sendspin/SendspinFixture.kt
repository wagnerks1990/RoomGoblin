import android.content.Context
import com.sendspin.protocol.SendSpinClient
import com.sendspin.protocol.State
import org.roomgoblin.display.*
object SendspinFixture {
 @JvmStatic fun main(args:Array<String>){
  val names=listOf("initial configuration connects","unchanged configuration preserves connection","renamed player updates active connection","partial configuration retains saved URL","disable stops connection","invalid URL preserves prior state","manual reconnect preserves client identity","missing initial URL rejects before persistence","new URL preserves identity","empty name uses stable fallback","failed connection closes its created client","connecting and handshaking are not ready")
  val url="ws://media.invalid:8927/sendspin";var failed=0
  for(index in names.indices){
   NativeSendspinManager.stop("fixture-reset");SendSpinClient.created.clear();val context=Context()
   try{
    if(index!=7)NativeSendspinManager.configure(context,true,url,if(index==9)"" else "First")
    val first=SendSpinClient.created.firstOrNull()
    when(index){
     0->check(first!=null&&first.url==url&&first.clientName=="First"&&NativeSendspinManager.status(context).getBoolean("connected"))
     1->{NativeSendspinManager.configure(context,true,url,"First");check(SendSpinClient.created.size==1)}
     2->{NativeSendspinManager.configure(context,true,url,"Renamed");check(SendSpinClient.created.size==2&&SendSpinClient.created.last().clientName=="Renamed"&&first!!.disconnected){"Saved name did not reach active player"}}
     3->{NativeSendspinManager.configure(context,true,null,"Renamed");check(SendSpinClient.created.last().url==url&&SendSpinClient.created.last().clientName=="Renamed")}
     4->{val status=NativeSendspinManager.configure(context,false,null,null);check(first!!.disconnected&&!status.getBoolean("enabled")&&!status.getBoolean("connected"))}
     5->{var rejected=false;try{NativeSendspinManager.configure(context,true,"invalid","Changed")}catch(expected:IllegalArgumentException){rejected=true};check(rejected&&SendSpinClient.created.size==1&&!first!!.disconnected&&NativeSendspinManager.status(context).getString("name")=="First")}
     6->{NativeSendspinManager.reconnect(context);check(SendSpinClient.created.size==2&&SendSpinClient.created.last().clientId==first!!.clientId&&first.disconnected)}
     7->{var rejected=false;try{NativeSendspinManager.configure(context,true,null,"Missing")}catch(expected:IllegalArgumentException){rejected=true};check(rejected&&SendSpinClient.created.isEmpty()&&!HubStorage.prefs(context).getBoolean("sendspin_enabled",false))}
     8->{NativeSendspinManager.configure(context,true,"wss://next.invalid/sendspin","First");check(SendSpinClient.created.size==2&&SendSpinClient.created.last().clientId==first!!.clientId&&first.disconnected)}
     9->{check(first!!.clientName=="RoomGoblin FixtureModel");NativeSendspinManager.configure(context,true,url,"   ");check(SendSpinClient.created.size==1)}
     10->{SendSpinClient.failNextConnect=true;val status=NativeSendspinManager.configure(context,true,"ws://failure.invalid/sendspin","First");check(SendSpinClient.created.last().disconnected&&!status.getBoolean("connected")){"Failed connection retained its client"}}
     11->{for(state in listOf(State.IDLE,State.CONNECTING,State.HANDSHAKING,State.ERROR,State.DISCONNECTED)){first!!.state.value=state;check(!NativeSendspinManager.status(context).getBoolean("connected")){"Unready state reported connected: "+state}};for(state in listOf(State.CLOCK_SYNCING,State.STREAMING)){first!!.state.value=state;check(NativeSendspinManager.status(context).getBoolean("connected"))}}
    }
    println("PASS "+names[index])
   }catch(error:Throwable){failed++;println("FAIL "+names[index]+": "+error.message)}finally{NativeSendspinManager.stop("fixture-cleanup")}
  }
  println("Android Sendspin configuration: ${names.size-failed} passed, $failed failed, 0 skipped")
  if(failed!=0)kotlin.system.exitProcess(1)
 }
}
