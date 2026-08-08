document.addEventListener('DOMContentLoaded',function(){
var btn=document.querySelector('.nav-toggle'),nav=document.getElementById('site-nav');
if(!btn||!nav)return;
btn.addEventListener('click',function(){
  var open=nav.classList.toggle('is-open');
  btn.setAttribute('aria-expanded',open?'true':'false');
  document.body.classList.toggle('nav-locked',open);
});
nav.addEventListener('click',function(e){
  if(e.target.tagName==='A'){nav.classList.remove('is-open');btn.setAttribute('aria-expanded','false');document.body.classList.remove('nav-locked');}
});
});