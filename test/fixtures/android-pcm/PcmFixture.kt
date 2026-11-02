import org.roomgoblin.display.AndroidPcmSendspinPlayer
import android.media.AudioTrack
import com.sendspin.protocol.*
import java.util.concurrent.TimeUnit
object PcmFixture {
 @JvmStatic fun main(args:Array<String>){
  val names=listOf("normal playback and volume","unsupported format preserves current track","stop releases its track","retired worker cannot use a replacement track","failed start permits a corrected retry")
  var failed=0
  for(index in names.indices){
   AudioTrack.created.clear();AudioTrack.blockWrites=index==3
   val buffer=AudioBuffer();val player=AndroidPcmSendspinPlayer(buffer,ClockSync())
   try{
    player.configure(StreamFormat());val first=AudioTrack.created.single()
    when(index){
     0->{player.setVolume(.3f);buffer.add();player.start();check(first.entered.await(2,TimeUnit.SECONDS));check(player.isPlaying&&first.gain==.3f)}
     1->{try{player.configure(StreamFormat(codec="opus"));error("Unsupported codec accepted")}catch(expected:IllegalArgumentException){};check(AudioTrack.created.size==1&&!first.released)}
     2->{buffer.add();player.start();check(first.entered.await(2,TimeUnit.SECONDS));player.stop();check(first.released&&!player.isPlaying)}
     3->{buffer.add();player.start();check(first.entered.await(2,TimeUnit.SECONDS));val oldWorker=first.writers.single();player.transition(StreamFormat());val next=AudioTrack.created.last();buffer.add();check(next.entered.await(2,TimeUnit.SECONDS));buffer.add();first.gate.countDown();oldWorker.join(1000);check(!oldWorker.isAlive&&!next.writers.contains(oldWorker)&&buffer.chunks.size==1){"Retired worker resumed against replacement audio"}}
     4->{first.failPlay=true;try{player.start();error("Synthetic start did not fail")}catch(expected:IllegalStateException){};first.failPlay=false;buffer.add();player.start();check(first.entered.await(2,TimeUnit.SECONDS)&&player.isPlaying){"Failed start blocked a corrected retry"}}
    }
    println("PASS "+names[index])
   }catch(error:Throwable){failed++;println("FAIL "+names[index]+": "+error.message)}finally{
    player.stop();AudioTrack.created.forEach{it.gate.countDown()};AudioTrack.created.flatMap{it.writers}.distinct().forEach{it.join(2000)}
   }
  }
  println("Android PCM ownership: ${names.size-failed} passed, $failed failed, 0 skipped")
  if(failed!=0)kotlin.system.exitProcess(1)
 }
}
