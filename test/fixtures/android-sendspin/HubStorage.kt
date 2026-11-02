package org.roomgoblin.display
import android.content.Context
import com.sendspin.protocol.*
class Prefs {val values=mutableMapOf<String,Any>();fun getInt(k:String,d:Int)=values[k] as? Int?:d;fun getString(k:String,d:String?):String?=values[k] as? String?:d;fun getBoolean(k:String,d:Boolean)=values[k] as? Boolean?:d;fun edit()=Editor(this)}
class Editor(val prefs:Prefs){val pending=mutableMapOf<String,Any>();fun putString(k:String,v:String):Editor{pending[k]=v;return this};fun putInt(k:String,v:Int):Editor{pending[k]=v;return this};fun putBoolean(k:String,v:Boolean):Editor{pending[k]=v;return this};fun apply(){prefs.values.putAll(pending)}}
object HubStorage {val stores=java.util.WeakHashMap<Context,Prefs>();fun prefs(c:Context)=stores.getOrPut(c){Prefs()}}
object BuildConfig {const val VERSION_NAME="fixture"}
class AndroidPcmSendspinPlayer(b:AudioBuffer,c:ClockSync){val isPlaying=false;val droppedDecodeFrames=0L}
