(() => {
  'use strict';
  const config = window.ADG_CONFIG || { email: 'alisa@adghospitality.com', inquiryEnabled: false };
  const $ = (s) => document.querySelector(s);
  const form = $('#inquiry-form');
  const status = $('#form-status');
  const menu = $('.menu-toggle');
  const nav = $('#navigation');
  const initialTime = Date.now();
  let currentId = null;
  let lastBody = '';
  $('#year').textContent = new Date().getFullYear();
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    menu.querySelector('.sr-only').textContent = expanded ? 'Open navigation' : 'Close navigation';
    nav.classList.toggle('is-open', !expanded);
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if(nav.classList.contains('is-open')) menu.focus();nav.classList.remove('is-open'); menu.setAttribute('aria-expanded', 'false');if(!chat.hidden && chat.contains(document.activeElement)){closeChat();launcher.focus();}else closeChat(); } });
  const packages = {
    Petite: {price:'$3,500',description:'For a meaningful ceremony and a beautiful, unhurried beginning together.',features:['Planning, vendor coordination and a ceremony timeline','An officiant and a personalized ceremony','A bouquet and boutonniere, or equivalent couple’s florals','Portrait photography, with coverage defined in your proposal','Location guidance and coordination of the agreed essentials']},
    Signature: {price:'$5,000',description:'For a styled ceremony and a celebratory moment with your favorite people.',features:['The ceremony essentials envisioned in Petite','Expanded photography coverage and floral styling','Ceremony seating and thoughtful setup details','A celebratory toast and petite cake','Coordination of a more personalized intimate celebration']},
    Premier: {price:'$7,500',description:'For an elevated celebration, a distinctive setting and the joy of lingering together.',features:['The experience envisioned in Signature','Premium venue sourcing and a more developed design direction','An intimate dining experience, tailored to your guest count','Expanded planning and celebration coordination','A hospitality-led experience from arrival to your final toast']},
  };
  const dialog = $('#package-dialog');
  let chosenPackage = '';
  document.querySelectorAll('[data-package]').forEach(button => button.addEventListener('click', () => {
    chosenPackage = button.dataset.package;
    const details = packages[chosenPackage];
    $('#dialog-title').textContent = chosenPackage;
    $('#dialog-price').textContent = `From ${details.price}`;
    $('#dialog-description').textContent = details.description;
    $('#dialog-features').replaceChildren(...details.features.map(item => { const li = document.createElement('li'); li.textContent = item; return li; }));
    dialog.showModal();
  }));
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  $('#dialog-inquire').addEventListener('click', () => { $('#package').value = chosenPackage; dialog.close(); $('#inquire').scrollIntoView({behavior:'smooth'}); $('#name').focus({preventScroll:true}); });
  const locations = {
    gardens:{heading:'Beneath the oaks',copy:'Lush gardens, quiet courtyards and canopies of Spanish moss. A romantic, naturally beautiful backdrop for an intimate ceremony.',area:'CHARLESTON · MOUNT PLEASANT · THE LOWCOUNTRY',image:'/assets/hero.webp',alt:'A garden ceremony envisioned beneath a canopy of live oaks',index:'01 — 03',position:'74% 50%'},
    historic:{heading:'A Charleston kind of charm',copy:'Intimate courtyards, graceful architecture and a rooftop view. Pair your ceremony with portraits around the historic district and a beautiful private celebration.',area:'HISTORIC CHARLESTON · COURTYARDS · PRIVATE VENUES',image:'/assets/story.webp',alt:'A romantic floral detail beside a classical garden balustrade',index:'02 — 03',position:'50% 50%'},
    coastal:{heading:'Where the light meets the sea',copy:'Golden-hour vows, soft coastal colors and a little salt in the air. Beach and waterfront settings have their own permit, access and guest-count requirements; we’ll guide you through them.',area:'FOLLY BEACH · ISLE OF PALMS · THE CHARLESTON COAST',image:'/assets/coast.webp',alt:'An intimate coastal wedding envisioned in the golden evening light',index:'03 — 03',position:'50% 50%'}
  };
  const tabs = [...document.querySelectorAll('[data-location]')];
  function chooseLocation(tab) {
    tabs.forEach(t => {t.setAttribute('aria-selected', String(t === tab)); t.tabIndex = t === tab ? 0 : -1;});
    const data = locations[tab.dataset.location];
    const panel = $('#location-panel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.querySelector('h3').textContent = data.heading;
    panel.querySelector('p').textContent = data.copy;
    panel.querySelector('span').textContent = data.area;
    $('#location-photo').src = data.image;
    $('#location-photo').alt = data.alt;
    $('#location-photo').style.objectPosition = data.position;
    $('.photo-index').textContent = data.index;
  }
  tabs.forEach((tab,index) => { tab.addEventListener('click', () => chooseLocation(tab)); tab.addEventListener('keydown',e => { let next; if(e.key === 'ArrowRight') next=tabs[(index+1)%tabs.length]; if(e.key === 'ArrowLeft') next=tabs[(index-1+tabs.length)%tabs.length]; if(e.key === 'Home') next=tabs[0]; if(e.key === 'End') next=tabs.at(-1); if(next){e.preventDefault();chooseLocation(next);next.focus();} }); });
  const validBookingUrl = (() => { try { const u = new URL(config.bookingUrl); return u.protocol === 'https:' && ['cal.com','www.cal.com','calendly.com','www.calendly.com','calendar.google.com','calendar.app.google'].includes(u.hostname) ? u.href : ''; } catch { return ''; } })();
  function planCall() {
    closeChat();
    if (validBookingUrl) {
      // The provider owns live availability, confirmations and rescheduling.
      window.open(validBookingUrl, '_blank', 'noopener,noreferrer');
    } else {
      $('#inquire').scrollIntoView({behavior:'smooth'});
      $('#preferredCall').focus({preventScroll:true});
      status.className='form-status';
      status.textContent='Tell us your preferred time and complete your inquiry. Alisa will coordinate the conversation with you; this does not reserve a calendar appointment.';
    }
  }
  if(validBookingUrl){ $('#schedule-button').innerHTML='CHOOSE A TIME <svg class="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" stroke="currentColor" stroke-width="1.2"/></svg>'; $('#schedule-note').textContent='Opens our booking calendar in a new tab. Choose a time and receive confirmation from the calendar service.'; }
  $('#schedule-button').addEventListener('click',planCall);
  // No credentials, saved chat history or third-party chat requests.
  const launcher = $('#chat-launcher');
  const chat = $('#chat-panel');
  function closeChat(){if(!chat.hidden){chat.hidden=true;launcher.setAttribute('aria-expanded','false');}}
  launcher.addEventListener('click', () => { const opening=chat.hidden;chat.hidden=!opening;launcher.setAttribute('aria-expanded',String(opening));if(opening)$('#chat-close').focus(); });
  $('#chat-close').addEventListener('click',()=>{closeChat();launcher.focus();});
  const answers = {
    packages:['The collection','Petite starts at $3,500; Signature at $5,000; Premier at $7,500. Each step adds scope and hospitality. Final services, venue fees and total investment are confirmed in your proposal.'],
    guests:['Your favorite people','Just the two of you, or up to 30 guests. Venue limits may be lower: some Charleston public parks allow only 25 people total, including the couple. We’ll help find the right fit.'],
    license:['Your marriage license','South Carolina requires a marriage license and an authorized officiant. There is a 24-hour waiting period. Charleston County advises allowing two business days for delivery after a completed application. See the planning guide for official links.'],
    rain:['A thoughtful weather plan','We discuss a backup when selecting the setting. Your proposal explains the indoor or covered alternative, timing options and any related costs.'],
    human:['A personal conversation','Alisa can help with availability, customization and your specific questions. Email alisa@adghospitality.com or send the inquiry below.']
  };
  document.querySelectorAll('[data-chat]').forEach(button => button.addEventListener('click',()=>{
    const topic=button.dataset.chat;if(topic==='call'){planCall();return;}
    const [title,answer]=answers[topic];
    const bubble=document.createElement('p');bubble.className='chat-answer';
    const strong=document.createElement('strong');strong.textContent=title;
    bubble.append(strong,document.createTextNode(answer));
    if(topic==='human'){const link=document.createElement('a');link.href=`mailto:${config.email}`;link.textContent=' Email Alisa ↗';bubble.append(link);}
    if(topic==='license'){const link=document.createElement('a');link.href='/guides/charleston-elopement-guide/';link.textContent=' Read the guide ↗';bubble.append(link);}
    const messages=$('#chat-messages');messages.append(bubble);while(messages.children.length>8)messages.children[1].remove();messages.scrollTop=messages.scrollHeight;
  }));
  function localDate() { const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const date=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${date.year}-${date.month}-${date.day}`; }
  $('#date').min=localDate();
  function showStatus(message,type=''){status.textContent=message;status.className=`form-status ${type}`;}
  function uuid(){return globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});}
  function mailText(data) { return ['Hello Alisa,','We’d love to plan our Charleston celebration.','',`Name: ${data.name}`,`Partner: ${data.partner || 'Not specified'}`,`Email: ${data.email}`,`Phone: ${data.phone || 'Not specified'}`,`Wedding date: ${data.date || 'Still deciding'}`,`Guests: ${data.guests}`,`Package: ${data.package}`,`Setting: ${data.location || 'Open to inspiration'}`,`Preferred call time: ${data.preferredCall || 'Flexible'}`,'',data.message || '', '', 'I agree to be contacted about this inquiry.'].join('\n'); }
  if(!config.inquiryEnabled){$('#submit-inquiry').innerHTML='EMAIL YOUR INQUIRY <svg class="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" stroke="currentColor" stroke-width="1.2"/></svg>';$('#form-fineprint').textContent='This opens a prepared email to Alisa. Please send it from your email app. Your date is reserved only after confirmation and the agreed booking requirements.';}
  form.addEventListener('input',e=>{if(e.target.matches('input,select,textarea'))e.target.removeAttribute('aria-invalid');});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const fields=[...form.querySelectorAll('input,select,textarea')];
    fields.forEach(el=>el.removeAttribute('aria-invalid'));
    const name=$('#name');name.setCustomValidity(name.value.trim().length>=2?'':'Please enter your name (at least two characters).');
    $('#date').setCustomValidity($('#date').value && $('#date').value<localDate()?'Please choose today or a future date.':'');
    const invalid=fields.filter(el=>!el.checkValidity());
    if(invalid.length){invalid.forEach(el=>el.setAttribute('aria-invalid','true'));showStatus('Please complete the required fields, enter a valid email, and keep your guest count between 0 and 30.','error');invalid[0].focus();invalid[0].reportValidity();return;}
    const data=Object.fromEntries(new FormData(form));data.name=data.name.trim();data.guests=Number(data.guests);data.consent=$('#consent').checked;data.submittedAt=initialTime;
    if(data.website){showStatus('Please contact Alisa directly by email.','error');return;}
    if(!config.inquiryEnabled){
      const text=mailText(data);
      const href=`mailto:${encodeURIComponent(config.email)}?subject=${encodeURIComponent(`Charleston elopement inquiry — ${data.package}`)}&body=${encodeURIComponent(text)}`;
      window.location.href=href;
      showStatus('Your email draft is ready. Send it from your email app to complete the inquiry. If an app did not open, copy the details and email Alisa.');
      const copy=document.createElement('button');copy.type='button';copy.className='text-link';copy.textContent='COPY INQUIRY DETAILS';copy.style.marginTop='12px';
      copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);copy.textContent='COPIED — EMAIL ALISA';}catch{const area=document.createElement('textarea');area.value=text;area.style.width='100%';area.rows=8;status.append(area);area.focus();area.select();copy.remove();}});
      status.append(document.createElement('br'),copy);return;
    }
    const body=JSON.stringify(data);if(body!==lastBody){currentId=uuid();lastBody=body;}
    const submit=$('#submit-inquiry');submit.disabled=true;submit.textContent='SENDING YOUR INQUIRY…';form.setAttribute('aria-busy','true');showStatus('Sending your inquiry…');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(config.inquiryEndpoint||'/api/inquiry',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':currentId},body,signal:controller.signal});
      const result=await response.json();
      if(!response.ok||result.success!==true){
        const errors=result.errors&&typeof result.errors==='object'?Object.entries(result.errors):[];
        let focused=false;
        for(const [key,message] of errors){const field=form.elements.namedItem(key);if(field && 'focus' in field){field.setAttribute('aria-invalid','true');if(!focused){field.focus();focused=true;}}}
        throw new Error(errors.length?errors.map(([,message])=>String(message)).join(' '):result.message||'We couldn’t send the inquiry. Please try again or email Alisa directly.');
      }
      showStatus('Thank you — your inquiry has been sent to Alisa. We look forward to hearing more about your day. Your wedding date is not reserved yet.','success');form.reset();lastBody='';currentId=null;
    }catch(error){showStatus(error.name==='AbortError'?'The connection timed out. Your details are still here; please retry or email Alisa directly.':error.message,'error');}
    finally{clearTimeout(timer);submit.disabled=false;submit.innerHTML='SEND YOUR INQUIRY <svg class="arrow-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11" stroke="currentColor" stroke-width="1.2"/></svg>';form.removeAttribute('aria-busy');}
  });
})();
