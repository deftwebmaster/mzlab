export const ZONE = 'America/Chicago';
export const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Phase Two weekly attendance goal (Monday–Sunday). Change it here only.
export const WEEKLY_GOAL = 3;

// Every Club meeting lasts one hour.
export const MEETING_MINUTES = 60;

// Requirement labels, taken from the handout's legend.
// Phase One: mandatory (dark), conditional (medium), optional (white).
// Phase Two (from the Phase 2 Policies sheet): mandatory, onproperty (mandatory if on property),
// common (at the meeting, off property, or in your room or the Phase 2 common area).
export const RULES = {
 one: {
  mandatory: {label:'Mandatory', detail:'You must attend.'},
  conditional: {label:'Attend or be off property', detail:'If you stay on property, you must attend.'},
  optional: {label:'Optional', detail:'You can choose to attend.'}
 },
 two: {
  mandatory: {label:'Mandatory', detail:'You must attend.'},
  onproperty: {label:'Mandatory if on property', detail:'If you are on property, you must attend.'},
  common: {label:'Meeting, your room, or Phase 2 common area', detail:'During the meeting, be at the meeting, in your room, in the Phase 2 common area, or off property.'}
 }
};
export const ruleFor = (meeting, phase) => phase === 'two' ? meeting.phase2 : meeting.rule;

// rule = Phase One rule; phase2 = Phase Two rule; counts = counts toward the Phase Two weekly goal.
const m = (time, title, rule='optional', note='', extra={}) => ({time, title, rule, phase2:'common', counts:true, note, ...extra});
const morning = () => m('07:00','Prayer & Meditation');
const noon = () => m('12:00','Open Discussion','conditional');
const houseMeeting = () => m('21:15','Monday Night House Meeting','mandatory','Doesn’t count toward the Phase Two weekly goal.',{phase2:'mandatory', counts:false});

export const WEEK = [
 // Sunday
 [morning(),m('11:00','Open Discussion','conditional'),m('14:00','Open Al-Anon'),m('16:00','Big Book Study','conditional','The printed schedule marks this with ***; no explanation is provided.'),m('18:00','Big Book Study','mandatory')],
 // Monday
 [morning(),noon(),m('17:00','Big Book Study'),m('18:30','DAA Big Book Study','conditional'),m('20:00','Story Speaker','mandatory'),houseMeeting()],
 // Tuesday
 [morning(),noon(),m('17:00','Big Book Study'),m('18:30','Open Big Book Study','conditional'),m('20:00','DAA Speaker','mandatory')],
 // Wednesday
 [morning(),noon(),m('15:00','PL Big Book','optional','Printed as “**3 PM PL BIG BOOK.” The abbreviation and asterisks are not explained.'),m('17:00','Big Book Study'),m('18:30','Big Book Study','conditional'),m('20:00','Big Book Study','mandatory')],
 // Thursday
 [morning(),noon(),m('17:00','Opiates Anonymous'),m('18:30','Big Book Study','conditional'),m('20:00','Step Speaker','mandatory')],
 // Friday
 [morning(),noon(),m('17:00','AA Topic Meeting'),m('18:30','Big Book Study'),m('20:00','Bag of Hope','conditional'),m('22:00','Call Up Meeting','mandatory')],
 // Saturday
 [morning(),noon(),m('14:00','Big Book Study'),m('16:00','12 & 12 Book Study','optional','The printed schedule marks this with ***; no explanation is provided.'),m('18:00','NA Discussion'),m('20:00','Big Book Study / Speaker','conditional'),m('22:00','4D CA Big Book Topic','mandatory','The meeting name is faint on the scan. Confirm with staff.')]
];

export function dallasNow(now=new Date()) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
export function dateFor(iso) {return new Date(`${iso}T12:00:00Z`);}
export function shiftDate(iso,n) {const d=dateFor(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
// Ross Ave. Group Birthday Night replaces the 8 PM meeting on the last Saturday of each month.
export const BIRTHDAY_NIGHT = {time:'20:00',title:'Ross Ave. Group Birthday Night',rule:'mandatory',phase2:'onproperty',note:'Last Saturday of the month.'};
export function isLastSaturday(iso) {const d=dateFor(iso);return d.getUTCDay()===6&&dateFor(shiftDate(iso,7)).getUTCMonth()!==d.getUTCMonth();}
export function meetingsFor(iso) {
 const list=WEEK[dateFor(iso).getUTCDay()].map(x=>({...x}));
 if(isLastSaturday(iso))Object.assign(list.find(x=>x.time===BIRTHDAY_NIGHT.time),BIRTHDAY_NIGHT);
 return list;
}
export function timeMinutes(time) {const [h,m]=time.split(':').map(Number);return h*60+m;}
export function timeLabel(time) {const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
export function endTime(time) {const end=(timeMinutes(time)+MEETING_MINUTES)%1440;return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;}
export function isInProgress(meeting, minutes) {const start=timeMinutes(meeting.time);return minutes>=start&&minutes<start+MEETING_MINUTES;}
export function inProgressMeetings(iso, minutes) {return meetingsFor(iso).filter(m=>isInProgress(m,minutes));}

/* ---------- Phase One mandatory meetings as a calendar (.ics) ----------
   Used by the app's "Download calendar file" button and by tools/build-calendar.mjs,
   which writes phase-one-mandatory.ics for calendar subscriptions. */
const BYDAY=['SU','MO','TU','WE','TH','FR','SA'];
const icsText=s=>s.replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
function icsFold(line){
 // Lines may be at most 75 bytes; continuation lines start with a space.
 const enc=new TextEncoder(),parts=[];let cur='',bytes=0;
 for(const ch of line){const b=enc.encode(ch).length;if(bytes+b>(parts.length?74:75)){parts.push(cur);cur='';bytes=0;}cur+=ch;bytes+=b;}
 parts.push(cur);return parts.join('\r\n ');
}
const icsLocal=(iso,time)=>`${iso.replaceAll('-','')}T${time.replace(':','')}00`;
const icsUtc=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function icsEnd(iso,time){const total=timeMinutes(time)+MEETING_MINUTES;return icsLocal(shiftDate(iso,Math.floor(total/1440)),endTime(time));}
const firstOnOrAfter=(iso,test)=>{for(let i=0;i<400;i++){const d=shiftDate(iso,i);if(test(d))return d;}throw Error('No matching date');};

function icsHeader(name,description){
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ManicZone//24 Meeting Tracker//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
  'X-WR-CALNAME:'+icsText(name),'X-WR-CALDESC:'+icsText(description),'X-WR-TIMEZONE:'+ZONE,
  'REFRESH-INTERVAL;VALUE=DURATION:PT12H','X-PUBLISHED-TTL:PT12H',
  'BEGIN:VTIMEZONE','TZID:'+ZONE,
  'BEGIN:DAYLIGHT','TZOFFSETFROM:-0600','TZOFFSETTO:-0500','TZNAME:CDT','DTSTART:19700308T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU','END:DAYLIGHT',
  'BEGIN:STANDARD','TZOFFSETFROM:-0500','TZOFFSETTO:-0600','TZNAME:CST','DTSTART:19701101T020000','RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU','END:STANDARD',
  'END:VTIMEZONE'];
}
const icsFinish=lines=>[...lines,'END:VCALENDAR'].map(icsFold).join('\r\n')+'\r\n';

export function phaseOneMandatoryCalendar({start=dallasNow().date, stamp=new Date()}={}) {
 const lines=icsHeader('Phase One Mandatory Meetings','Mandatory Dallas 24 Hour Club meetings for Phase One residents.');
 const event=(uid,iso,m,rrule,description)=>lines.push('BEGIN:VEVENT',`UID:${uid}@daily-meetings.dallas24hourclub`,'DTSTAMP:'+icsUtc(stamp),
  `DTSTART;TZID=${ZONE}:${icsLocal(iso,m.time)}`,`DTEND;TZID=${ZONE}:${icsEnd(iso,m.time)}`,'RRULE:'+rrule,
  'SUMMARY:'+icsText(`${m.title} (Mandatory)`),'LOCATION:'+icsText('Dallas 24 Hour Club'),'DESCRIPTION:'+icsText(description),'TRANSP:OPAQUE',
  'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT30M','DESCRIPTION:'+icsText(`${m.title} starts in 30 minutes`),'END:VALARM','END:VEVENT');
 WEEK.forEach((day,weekday)=>{
  for(const m of day.filter(x=>x.rule==='mandatory')){
   const first=firstOnOrAfter(start,d=>dateFor(d).getUTCDay()===weekday);
   event(`phase1-${BYDAY[weekday].toLowerCase()}-${m.time.replace(':','')}`,first,m,`FREQ=WEEKLY;BYDAY=${BYDAY[weekday]}`,'Mandatory for Phase One residents.');
  }
 });
 event('phase1-birthday-night',firstOnOrAfter(start,isLastSaturday),BIRTHDAY_NIGHT,'FREQ=MONTHLY;BYDAY=-1SA','Last Saturday of the month. Mandatory for Phase One; Phase Two must attend if on property.');
 return icsFinish(lines);
}

/* ---------- Weekly check-in (due every Sunday, both phases) ---------- */
// If the QR code on the sheet points to a web form, put its address here to show an "Open the add-on check-in" button.
export const CHECKIN_FORM_URL = '';

// All-day event every Sunday, with reminders Saturday at 6 PM and Sunday at 9 AM.
export function weeklyCheckinCalendar({start=dallasNow().date, stamp=new Date()}={}) {
 const sunday=firstOnOrAfter(start,d=>dateFor(d).getUTCDay()===0);
 const day=iso=>iso.replaceAll('-','');
 const alarm=(trigger,text)=>['BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:'+trigger,'DESCRIPTION:'+icsText(text),'END:VALARM'];
 return icsFinish([...icsHeader('Weekly Check-In','Reminder to turn in the Dallas 24 Hour Club weekly check-in sheet every Sunday.'),
  'BEGIN:VEVENT','UID:weekly-checkin-sunday@daily-meetings.dallas24hourclub','DTSTAMP:'+icsUtc(stamp),
  'DTSTART;VALUE=DATE:'+day(sunday),'DTEND;VALUE=DATE:'+day(shiftDate(sunday,1)),'RRULE:FREQ=WEEKLY;BYDAY=SU',
  'SUMMARY:Turn in weekly check-in sheet','LOCATION:'+icsText('Dallas 24 Hour Club'),
  'DESCRIPTION:'+icsText('Turn in your completed weekly check-in sheet and scan its QR code for the add-on check-in. Mark both done in the 24 Meeting Tracker app.'),
  'TRANSP:TRANSPARENT',
  ...alarm('-PT6H','Weekly check-in sheet is due tomorrow'),
  ...alarm('PT9H','Turn in your weekly check-in sheet today'),
  'END:VEVENT']);
}

/* =====================================================================
   Time helpers, next-meeting search, and Phase One daily essentials.
   Every function takes an optional `now` (a Date) so it can be tested
   with a simulated clock: node tools/test-cyanviolet-schedule.mjs
   ===================================================================== */

// The real instant (ms since epoch) of a Dallas wall-clock time. Handles daylight-saving changes:
// a skipped time (2:30 AM on the spring-forward day) resolves to the following real instant.
export function dallasInstant(iso, minutes) {
 const [y,mo,d]=iso.split('-').map(Number);
 const wall=Date.UTC(y,mo-1,d)+minutes*60000;
 for(const offsetHours of [5,6]){const t=wall+offsetHours*3600000,n=dallasNow(new Date(t));if(n.date===iso&&n.minutes===minutes)return t;}
 return wall+5*3600000;
}
// Whole minutes from `now` until a Dallas wall-clock time; never negative.
export function minutesUntil(iso, minutes, now=new Date()) {return Math.max(0,Math.ceil((dallasInstant(iso,minutes)-now.getTime())/60000));}
// "25 min", "2h", "2h 15m", "1d", "1d 2h".
export function durationLabel(total) {
 if(total<60)return `${total} min`;
 if(total<1440){const m=total%60;return `${Math.floor(total/60)}h${m?` ${m}m`:''}`;}
 const d=Math.floor(total/1440),h=Math.floor((total%1440)/60);return `${d}d${h?` ${h}h`:''}`;
}
export const isWeekendDate=iso=>[0,6].includes(dateFor(iso).getUTCDay());

// First meeting (today or later) that matches `test`, including one already in progress.
// Returns {meeting, date, live, startsIn, endsIn} using the shared 60-minute meeting length.
export function nextMeetingWhere(test, now=new Date(), {searchDays=14}={}) {
 const {date:today,minutes}=dallasNow(now);
 for(let i=0;i<=searchDays;i++){
  const date=shiftDate(today,i);
  for(const meeting of meetingsFor(date).filter(test)){
   const start=timeMinutes(meeting.time),live=i===0&&isInProgress(meeting,minutes);
   if(i>0||start>minutes||live)return {meeting,date,live,startsIn:minutesUntil(date,start,now),endsIn:minutesUntil(date,start+MEETING_MINUTES,now)};
  }
 }
 return null;
}
// Phase One: only meetings labelled Mandatory ("Attend or be off property" is not mandatory).
export const isPhaseOneMandatory=m=>ruleFor(m,'one')==='mandatory';
// Phase Two: the Monday Night House Meeting is the only weekly Mandatory meeting in the schedule.
export const isPhaseTwoMandatory=m=>ruleFor(m,'two')==='mandatory';

/* ---------- Phase One floor meals (from the Phase One schedule/rules sheet) ----------
   Minutes after midnight, Dallas time. A window is open from `start` up to, not including, `end`.
   Weekend dinner hours are not listed on the sheet, so they are null (unspecified), not "closed". */
export const MEALS = {
 breakfast: {label:'Breakfast & sack lunch pickup', weekday:{start:420,end:480}, weekend:{start:420,end:570}},
 dinner: {label:'Dinner floor meals', weekday:{start:1020,end:1185}, weekend:null}
};
export const SACK_LUNCH_TIP='Ask for your sack lunch when you get breakfast.';
export function mealWindow(meal, iso) {return MEALS[meal][isWeekendDate(iso)?'weekend':'weekday'];}
export function minutesLabel(min) {return min>=1440?'Midnight':timeLabel(`${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`);}
export function windowLabel(w) {return `${minutesLabel(w.start).replace(/ (AM|PM)$/,m=>minutesLabel(w.end).endsWith(m)?'':m)}–${minutesLabel(w.end)}`;}

// Current floor-meal situation. `state` is one of:
//  before-breakfast · breakfast · between-meals (weekday) · dinner · after-meals (weekday evening)
//  · weekend-day (after breakfast; dinner hours not listed)
export function mealStatus(now=new Date()) {
 const {date,minutes}=dallasNow(now),weekend=isWeekendDate(date);
 const bf=mealWindow('breakfast',date),dn=mealWindow('dinner',date);
 const tomorrow=shiftDate(date,1),nextBreakfast={date:tomorrow,window:mealWindow('breakfast',tomorrow),startsIn:minutesUntil(tomorrow,mealWindow('breakfast',tomorrow).start,now)};
 const base={date,minutes,weekend,breakfast:bf,dinner:dn,nextBreakfast};
 if(minutes<bf.start)return {...base,state:'before-breakfast',opensIn:minutesUntil(date,bf.start,now)};
 if(minutes<bf.end)return {...base,state:'breakfast',closesIn:minutesUntil(date,bf.end,now)};
 if(!dn)return {...base,state:'weekend-day'};
 if(minutes<dn.start)return {...base,state:'between-meals',opensIn:minutesUntil(date,dn.start,now)};
 if(minutes<dn.end)return {...base,state:'dinner',closesIn:minutesUntil(date,dn.end,now)};
 return {...base,state:'after-meals'};
}

/* ---------- Phase One daily rules (from the Phase One schedule/rules sheet) ----------
   Informational only. `time`/`end` are minutes after midnight; 1440 = midnight at the end of the day. */
export const CURFEW = {0:1320,1:1320,2:1320,3:1320,4:1320,5:1440,6:1440};   // Sun–Thu 10 PM · Fri–Sat midnight
export function dailyRulesFor(iso) {
 const day=dateFor(iso).getUTCDay(),weekend=day===0||day===6;
 const rules=weekend
  ?[{key:'wake',time:510,label:'Wake-up'},{key:'chores',time:540,label:'Chores completed'}]
  :[{key:'wake',time:360,label:'Mandatory wake-up'},{key:'chores',time:420,label:'Chores done and signed off by staff'},{key:'offsite',time:540,end:840,label:'Off property for a productive activity (if unemployed)'}];
 return [...rules,{key:'curfew',time:CURFEW[day],label:'Curfew'}];
}
// The sheet's rules as display text for the "Phase One daily rules" panel. Meeting times here are
// the sheet's wording; the schedule above stays the source of truth for meeting countdowns.
export const RULES_SHEET = {
 weekday: {title:'Weekdays (Monday–Friday)', rows:[
  ['Mandatory wake-up (you may get up earlier if you’re quiet)','6:00 AM'],
  ['Chores done and signed off by staff','By 7:00 AM'],
  ['Breakfast & sack lunch pickup','7:00–8:00 AM'],
  ['Off property for a productive activity (if unemployed)','9:00 AM–2:00 PM'],
  ['Dinner floor meals','5:00–7:45 PM'],
  ['Mandatory recovery meeting','Mon–Thu 8:00 PM · Fri 10:00 PM'],
  ['Curfew','Mon–Thu 10:00 PM · Fri midnight']]},
 weekend: {title:'Weekends (Saturday–Sunday)', rows:[
  ['Wake-up','8:30 AM'],
  ['Chores completed','By 9:00 AM'],
  ['Breakfast & sack lunch pickup','7:00–9:30 AM'],
  ['Off property during the day','Not required'],
  ['Dinner floor meals','Not listed on the sheet. Ask staff.'],
  ['Mandatory recovery meeting','Sat 10:00 PM · Sun 6:00 PM'],
  ['Curfew','Sat midnight · Sun 10:00 PM']]},
 showers: [
  ['Weekdays','Before 8:00 AM or after 5:00 PM, unless approved by staff.'],
  ['Weekends','Any time, except during the mandatory meetings (Friday and Saturday 10:00 PM, Sunday 6:00 PM).']],
 notes: [
  'Missing curfew is zero tolerance and will result in immediate discharge.',
  'On weekdays, a staff member must sign off that chores were done properly. This app does not record sign-off.',
  'For reference only. Staff instructions and the official Phase One sheet take priority.']
};
// The next informational item still ahead today (or under way, for windows). Meetings and curfew are
// shown elsewhere, so only wake-up, chores, and the off-property window are considered.
export function upcomingRule(now=new Date()) {
 const {date,minutes}=dallasNow(now);
 for(const r of dailyRulesFor(date).filter(r=>['wake','chores','offsite'].includes(r.key))){
  if(r.end&&minutes>=r.time&&minutes<r.end)return {...r,during:true,endsIn:minutesUntil(date,r.end,now)};
  if(minutes<r.time)return {...r,during:false,startsIn:minutesUntil(date,r.time,now)};
 }
 return null;
}
export function curfewFor(iso) {return CURFEW[dateFor(iso).getUTCDay()];}
