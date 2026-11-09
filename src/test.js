const fs=require('fs');eval(fs.readFileSync(__dirname+'/core.js','utf8'));
const f=(ms,tz)=>new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit'}).format(ms);
const noon=Date.UTC(2026,10,1,12);
for (const [n,lat,lon,tz,m,asr] of [['Mecca MWL',21.4225,39.8262,'Asia/Riyadh','MWL',1],['Mecca UQ',21.4225,39.8262,'Asia/Riyadh','Makkah',1],['London MWL',51.5074,-0.1278,'Europe/London','MWL',1],['NYC ISNA Hanafi',40.7128,-74.006,'America/New_York','ISNA',2],['Tromso MWL',69.65,18.96,'Europe/Oslo','MWL',1]]){
 const t=prayerTimes(lat,lon,noon,{method:m,asr,highLat:'angle'});
 console.log(n.padEnd(16),EVENTS.map(k=>k+' '+(isNaN(t[k])?'--':f(t[k],tz))).join('  '));}
