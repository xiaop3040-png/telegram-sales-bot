// Optional checker: fixed public origins, no redirects, no paid scraping provider.
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');
const blocked = new net.BlockList();
for (const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['192.0.0.0',24],['198.18.0.0',15],['224.0.0.0',4],['240.0.0.0',4]]) blocked.addSubnet(address,prefix,'ipv4');
function validateUrl(value){const url=new URL(value);const allowed=(process.env.CHECKER_ALLOWED_HOSTS||'').split(',').filter(Boolean);if(url.protocol!=='https:'||url.username||url.password||url.port||!allowed.includes(url.hostname))throw new Error('URL not allowed');return url;}
async function checkLink(value){
 if(process.env.ENABLE_LINK_CHECKER!=='true')return {url:value,status:'unknown',detail:'Checker disabled'};
 let url;try{url=validateUrl(value);}catch{return {url:value,status:'error',detail:'URL not allowed'};}
 return new Promise(resolve=>{
 const done=(status,httpStatus=0)=>resolve({url:value,status,httpStatus,detail:status==='unknown'?'Open the provider website to verify validity':'Unable to verify'});
 const request=https.get(url,{lookup:(host,options,callback)=>dns.lookup(host,{family:4},(err,address,family)=>{if(err||blocked.check(address,'ipv4'))return callback(new Error('Destination not allowed'));callback(null,options.all?[{address,family}]:address,family);}),timeout:8000},response=>{response.destroy();done(response.statusCode===404?'dead':'unknown',response.statusCode);});
 request.on('timeout',()=>request.destroy(new Error('Timeout')));request.on('error',()=>done('error'));
 });
}
async function checkLinks(urls,concurrency=3){const out=[];for(let i=0;i<Math.min(urls.length,20);i+=concurrency)out.push(...await Promise.all(urls.slice(i,i+concurrency).map(checkLink)));return out;}
module.exports={checkLink,checkLinks,validateUrl,getCachedResult:()=>null,getCacheStats:()=>({total:0}),extractClaudeCode:()=>null};
