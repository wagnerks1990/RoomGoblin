'use strict';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
class PostHistory{
 constructor(learning){this.learning=learning;this.db=learning.db;this.db.exec(`CREATE TABLE IF NOT EXISTS learning_post_versions(post_id TEXT NOT NULL REFERENCES learning_posts(id) ON DELETE CASCADE,revision INTEGER NOT NULL,body TEXT NOT NULL,editor_id TEXT REFERENCES users(id) ON DELETE SET NULL,editor_kind TEXT NOT NULL,recorded_at TEXT NOT NULL,PRIMARY KEY(post_id,revision));`);}
 change(post,body,user,kind){
  if(body===post.body)return false;
  // Caller holds the same SQLite transaction as the post update and audit event.
  const originalKind=post.revision===1?(post.kind==='ai'?'automatic':post.kind==='teacher'?'teacher':'author'):'unknown';
  const insert=this.db.prepare('INSERT OR IGNORE INTO learning_post_versions VALUES(?,?,?,?,?,?)');
  insert.run(post.id,post.revision,post.body,post.revision===1&&post.kind!=='ai'?post.user_id:null,originalKind,post.updated_at);
  const stamp=new Date().toISOString();insert.run(post.id,post.revision+1,body,user.id,kind,stamp);
  const result=this.db.prepare('UPDATE learning_posts SET body=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(body,stamp,post.id,post.revision);if(result.changes!==1)fail(409,'This comment changed. Refresh before editing.');return true;
 }
 list(user,activityId,postId,before){
  const activity=this.learning.activity(user,activityId),post=this.db.prepare('SELECT * FROM learning_posts WHERE id=? AND activity_id=?').get(postId,activityId);if(!post)fail(404,'Comment not found.');
  if(activity.member.role!=='teacher'){
   const visited=new Set();let row=post;
   while(row){if(row.hidden||visited.has(row.id)||visited.size>30)fail(404,'Comment not found.');visited.add(row.id);if(!row.parent_id)break;row=this.db.prepare('SELECT id,parent_id,hidden FROM learning_posts WHERE id=? AND activity_id=?').get(row.parent_id,activityId);if(!row)fail(404,'Comment not found.');}
  }
  if(before!==undefined&&(typeof before!=='string'||!/^[1-9][0-9]{0,8}$/.test(before)))fail(400,'Use a valid history revision cursor.');
  const cursor=before===undefined?Number.MAX_SAFE_INTEGER:Number(before),rows=this.db.prepare('SELECT revision,body,editor_kind,recorded_at FROM learning_post_versions WHERE post_id=? AND revision<? ORDER BY revision DESC LIMIT 51').all(post.id,cursor);
  if(post.revision<cursor&&!rows.some(v=>v.revision===post.revision))rows.unshift({revision:post.revision,body:post.body,editor_kind:post.revision===1?(post.kind==='ai'?'automatic':post.kind==='teacher'?'teacher':'author'):'unknown',recorded_at:post.updated_at});
  const first=this.db.prepare('SELECT MIN(revision) first FROM learning_post_versions WHERE post_id=?').get(post.id).first??post.revision,hasMore=rows.length>50,versions=rows.slice(0,50).map(v=>({revision:v.revision,body:v.body,editedAt:v.recorded_at,editor:v.editor_kind==='author'?'Author':v.editor_kind==='unknown'?'Not recorded':'Instructor',current:v.revision===post.revision}));
  return {postId:post.id,currentRevision:post.revision,historyComplete:first===1,historyAvailableFrom:first,versions,nextBeforeRevision:hasMore?versions.at(-1).revision:null};
 }
}
module.exports={PostHistory};
