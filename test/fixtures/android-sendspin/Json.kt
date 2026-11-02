package org.json
class JSONObject {val values=mutableMapOf<String,Any?>();fun put(k:String,v:Any?):JSONObject{values[k]=v;return this};fun getBoolean(k:String)=values[k] as Boolean;fun getString(k:String)=values[k] as String}
