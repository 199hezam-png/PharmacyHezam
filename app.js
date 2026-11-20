/* Pharmacy Manager - local-first starter implementation */
const DB_NAME = "pharmacy_manager_db";
const DB_VERSION = 1;
const STORE_NAMES = ["items","suppliers","invoices","invoiceLines","shortages","orders","audit"];
let db;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => new Intl.NumberFormat("ar-YE",{maximumFractionDigits:2}).format(Number(n||0));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;for(const n of STORE_NAMES){if(!d.objectStoreNames.contains(n)){const st=d.createObjectStore(n,{keyPath:"id",autoIncrement:true});if(n==="items")st.createIndex("name","name",{unique:false});if(n==="invoices")st.createIndex("fingerprint","fingerprint",{unique:false});}}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function store(name,mode="readonly"){return db.transaction(name,mode).objectStore(name)}
function all(name){return new Promise((res,rej)=>{const r=store(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function add(name,obj){return new Promise((res,rej)=>{const r=store(name,"readwrite").add(obj);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(name,obj){return new Promise((res,rej)=>{const r=store(name,"readwrite").put(obj);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function remove(name,id){return new Promise((res,rej)=>{const r=store(name,"readwrite").delete(Number(id));r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function transactionDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error("تم إلغاء العملية"))})}
async function audit(action,detail){await add("audit",{action,detail,at:new Date().toISOString()})}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
const pages={
 dashboard:["لوحة التحكم","ملخص حالة قاعدة البيانات والمشتريات"],
 items:["قاعدة الأصناف","إدارة بيانات الأصناف ووحدات القياس"],
 invoices:["استيراد الفواتير","استيراد ملفات Excel ومراجعة البيانات قبل الحفظ"],
 shortages:["إدارة النواقص","تسجيل الاحتياج ومتابعة الكميات المتبقية"],
 compare:["مقارنة الأسعار","مقارنة سعر الشراء الأصلي والتكلفة الفعلية بعد البونص"],
 orders:["طلبيات الشراء","تجهيز ومتابعة طلبات الشراء"],
 suppliers:["الموردون","دليل الموردين"],
 history:["سجل المشتريات","الفواتير والأصناف المستوردة"],
 backup:["النسخ الاحتياطي","تصدير قاعدة البيانات أو استعادتها"]
};
let currentPage="dashboard";
async function navigate(page){currentPage=page;$("#pageTitle").textContent=pages[page][0];$("#pageSubtitle").textContent=pages[page][1];$$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#sidebar").classList.remove("open");await render()}
function pageHead(title,desc,action=""){return `<div class="page-head"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">لا توجد بيانات لعرضها حالياً</td></tr>`}</tbody></table></div>`}
async function render(){const el=$("#pageContent");switch(currentPage){
case"dashboard":return renderDashboard(el);case"items":return renderItems(el);case"invoices":return renderInvoices(el);case"shortages":return renderShortages(el);case"compare":return renderCompare(el);case"orders":return renderOrders(el);case"suppliers":return renderSuppliers(el);case"history":return renderHistory(el);case"backup":return renderBackup(el);
}}
async function renderDashboard(el){const [items,sups,invs,shorts,orders,lines]=await Promise.all(["items","suppliers","invoices","shortages","orders","invoiceLines"].map(all));el.innerHTML=`
<div class="cards">
<div class="stat-card"><div class="label">إجمالي الأصناف</div><div class="value">${money(items.length)}</div><div class="hint">في قاعدة البيانات المحلية</div></div>
<div class="stat-card"><div class="label">الموردون</div><div class="value">${money(sups.length)}</div><div class="hint">الموردون المسجلون</div></div>
<div class="stat-card"><div class="label">فواتير المشتريات</div><div class="value">${money(invs.length)}</div><div class="hint">الفواتير المستوردة</div></div>
<div class="stat-card"><div class="label">النواقص النشطة</div><div class="value">${money(shorts.filter(x=>x.remaining>0).length)}</div><div class="hint">أصناف تحتاج إلى شراء</div></div>
</div>
<div class="panel"><h3>الوصول السريع</h3><div class="quick-grid">
<button class="quick" data-go="invoices"><b>⇧ استيراد فاتورة</b><span>رفع ملف XLS أو XLSX</span></button>
<button class="quick" data-go="shortages"><b>＋ إضافة نقص</b><span>تسجيل صنف وكمية مطلوبة</span></button>
<button class="quick" data-go="compare"><b>⇄ مقارنة الأسعار</b><span>معرفة أقل تكلفة فعلية</span></button>
<button class="quick" data-go="backup"><b>⬇ نسخة احتياطية</b><span>حفظ بيانات النظام</span></button>
</div></div>
<div class="panel"><h3>آخر الفواتير المستوردة</h3>${table(["رقم الفاتورة","المورد","التاريخ","عدد الأصناف"],invs.slice(-5).reverse().map(x=>`<tr><td>${esc(x.number)}</td><td>${esc(x.supplierName)}</td><td>${esc(x.date)}</td><td>${x.lineCount||0}</td></tr>`).join(""))}</div>
<div class="notice">تنبيه: هذه نسخة أولية تعمل محلياً داخل المتصفح. لا توجد مزامنة تلقائية بين الأجهزة. احتفظ بنسخة احتياطية دورية، ولا تعتمد عليها وحدها في تشغيل صيدلية قبل اختبارها على بيانات فعلية.</div>`;$$("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go))}
async function renderItems(el){
  const items=await all("items");
  el.innerHTML=pageHead("قاعدة الأصناف","أضف الأصناف مع تحديد وحدة المقارنة ومعامل التحويل.",`<button class="btn" id="addItem">＋ إضافة صنف</button>`)+`<div class="toolbar"><div class="field search"><input id="itemSearch" placeholder="ابحث بالاسم أو الاسم العلمي أو الكود..."></div></div><div id="itemsTable"></div>`;
  const draw=()=>{
    const q=$("#itemSearch").value.trim().toLowerCase();
    const list=items.filter(x=>[x.name,x.generic,x.code,x.strength].join(" ").toLowerCase().includes(q));
    $("#itemsTable").innerHTML=table(["الكود","اسم الصنف","الاسم العلمي","التركيز","الوحدة","معامل التحويل","إجراء"],list.map(x=>`<tr><td>${esc(x.code||"-")}</td><td><b>${esc(x.name)}</b></td><td>${esc(x.generic||"-")}</td><td>${esc(x.strength||"-")}</td><td>${esc(x.unit||"-")}</td><td>${esc(x.factor||1)}</td><td><button class="btn small danger" data-del="${x.id}">حذف</button></td></tr>`).join(""));
    $$("[data-del]").forEach(b=>b.onclick=async()=>{if(confirm("حذف الصنف؟")){await remove("items",b.dataset.del);await audit("حذف صنف",b.dataset.del);render()}});
  };
  $("#itemSearch").oninput=draw;draw();
  $("#addItem").onclick=()=>showModal("إضافة صنف",`<div class="grid-form">${field("اسم الصنف","name",true)}${field("الاسم العلمي","generic")}${field("الكود","code")}${field("التركيز","strength")}${field("الشكل الدوائي","form")}${field("وحدة الشراء","unit",true,"مثال: باكت")}${field("الوحدة الأساسية للمقارنة","baseUnit",true,"مثال: حبة")}${field("عدد الوحدات الأساسية في وحدة الشراء","factor",true,"1")}</div>`,async()=>{
    const f=formValues();const factor=Number(f.factor||1);
    if(!f.name||!f.unit||!f.baseUnit||!Number.isFinite(factor)||factor<=0)return toast("أكمل الحقول وتأكد أن معامل التحويل أكبر من صفر");
    f.factor=factor;await add("items",f);await audit("إضافة صنف",f.name);closeModal();toast("تمت إضافة الصنف");render();
  });
}
function field(label,name,required=false,placeholder=""){return `<div class="field"><label>${label}${required?" *":""}</label><input name="${name}" ${required?"required":""} placeholder="${placeholder}"></div>`}
function formValues(){return Object.fromEntries($$("#modalBody [name]").map(x=>[x.name,x.value.trim()]))}
function showModal(title,body,onSave,saveLabel="حفظ"){ $("#modalTitle").textContent=title;$("#modalBody").innerHTML=body;$("#modalActions").innerHTML=`<button type="button" class="btn" id="modalSave">${saveLabel}</button><button type="button" class="btn secondary" id="modalCancel">إلغاء</button>`;$("#modal").showModal();$("#modalSave").onclick=onSave;$("#modalCancel").onclick=closeModal}
function closeModal(){$("#modal").close()}
async function renderInvoices(el){const invs=await all("invoices");el.innerHTML=pageHead("استيراد الفواتير","يدعم Excel بصيغتي XLS وXLSX. راجع المعاينة قبل اعتماد الاستيراد.")+`
<div class="panel"><div class="dropzone"><strong>اختر ملف فاتورة Excel</strong><p>يدعم ملفات XLS وXLSX. تتم قراءة الملف داخل المتصفح.</p><label class="file-label">اختيار ملف <input type="file" id="invoiceFile" accept=".xls,.xlsx"></label></div><div id="importPreview"></div></div>
<div class="panel"><h3>الفواتير المستوردة</h3>${table(["رقم الفاتورة","المورد","التاريخ","الأصناف","الإجمالي"],invs.slice().reverse().map(x=>`<tr><td>${esc(x.number||"-")}</td><td>${esc(x.supplierName||"-")}</td><td>${esc(x.date||"-")}</td><td>${x.lineCount||0}</td><td>${money(x.total||0)}</td></tr>`).join(""))}</div>
<div class="notice">ملاحظة فنية: الاستيراد الحالي يحاول التعرف على عناوين الأعمدة الشائعة. ملفات البرامج المختلفة قد تحتاج إلى ضبط خريطة الأعمدة بعد اختبار عينات إضافية. لا تعتمد الاستيراد قبل مراجعة المعاينة.</div>`;
$("#invoiceFile").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=await file.arrayBuffer();const wb=XLSX.read(data,{type:"array",cellDates:true});const sheet=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false});const parsed=parseInvoiceRows(rows,file.name);window.pendingInvoice={...parsed,fileName:file.name};showInvoicePreview(parsed,file.name)}catch(err){console.error(err);toast("تعذر قراءة الملف. تأكد من سلامة ملف Excel.")}}}
function norm(v){return String(v??"").toLowerCase().replace(/[أإآ]/g,"ا").replace(/[ى]/g,"ي").replace(/[ًٌٍَُِّْـ]/g,"").replace(/[ـ\s]+/g," ").trim()}
function findValue(rows,keys){
  for(const row of rows.slice(0,25)) for(let i=0;i<row.length;i++){
    const cell=norm(row[i]);
    if(keys.some(k=>cell===norm(k)||cell.startsWith(norm(k)))){
      for(let j=i+1;j<Math.min(row.length,i+4);j++) if(String(row[j]??"").trim()) return String(row[j]).trim();
    }
  }
  return "";
}
function parseInvoiceRows(rows,fileName){
  const meta={number:findValue(rows,["رقم الفاتورة","رقم فاتورة","invoice no","invoice number"]),date:findValue(rows,["تاريخ الفاتورة","التاريخ","date"]),supplierName:findValue(rows,["اسم المورد","المورد","supplier"]),warehouse:findValue(rows,["المستودع","المخزن"]),fileName};
  const headerIndex=rows.findIndex(r=>{const h=r.map(norm);return h.some(x=>["الصنف","اسم الصنف","item","item name","البيان"].includes(x))&&h.some(x=>["الكمية","كمية","quantity","qty"].includes(x))});
  if(headerIndex<0) return {...meta,lines:[],total:0,parseError:"لم يتم العثور على صف عناوين يحتوي على اسم الصنف والكمية."};
  const headers=rows[headerIndex].map(norm);
  const idx=terms=>headers.findIndex(h=>terms.some(t=>h===norm(t)||h.includes(norm(t))));
  const ix={name:idx(["اسم الصنف","الصنف","item name","item","البيان"]),qty:idx(["الكمية","كمية","quantity","qty"]),unit:idx(["الوحدة","unit"]),price:idx(["سعر الوحدة","السعر","price"]),bonus:idx(["البونص","bonus"]),discount:idx(["الخصم","التخفيض","discount"]),batch:idx(["التشغيلة","رقم التشغيلة","batch"]),expiry:idx(["تاريخ الانتهاء","الانتهاء","expiry"]),total:idx(["إجمالي السطر","الإجمالي","المجموع","total"])};
  if(ix.name<0||ix.qty<0||ix.price<0) return {...meta,lines:[],total:0,parseError:"تعذر تحديد الأعمدة الأساسية (الصنف، الكمية، سعر الوحدة)."};
  const lines=[];
  for(const r of rows.slice(headerIndex+1)){
    const name=r[ix.name]; if(!String(name??"").trim()) continue;
    const qty=num(r[ix.qty]),price=num(r[ix.price]),bonus=ix.bonus>=0?num(r[ix.bonus]):0,discount=ix.discount>=0?num(r[ix.discount]):0;
    if(qty<=0||price<0) continue;
    const explicitTotal=ix.total>=0?num(r[ix.total]):0;
    lines.push({name:String(name).trim(),qty,unit:ix.unit>=0?String(r[ix.unit]||"").trim():"",price,bonus,discount,batch:ix.batch>=0?String(r[ix.batch]||"").trim():"",expiry:ix.expiry>=0?formatDate(r[ix.expiry]):"",total:explicitTotal>0?explicitTotal:qty*price,totalIncludesDiscount:false});
  }
  return {...meta,lines,total:lines.reduce((sum,x)=>sum+x.total,0)};
}
function num(v){
  if(typeof v==="number") return Number.isFinite(v)?v:0;
  let s=String(v??"").trim().replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٫]/g,".").replace(/\s/g,"").replace(/[^\d,.-]/g,"");
  const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
  if(comma>=0&&dot>=0){if(comma>dot)s=s.replace(/\./g,"").replace(",",".");else s=s.replace(/,/g,"");}
  else if(comma>=0){const decimals=s.length-comma-1;s=decimals>0&&decimals<=2?s.replace(",","."):s.replace(/,/g,"");}
  const n=Number(s);return Number.isFinite(n)?n:0;
}
function formatDate(v){if(v instanceof Date&&!Number.isNaN(v.getTime()))return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;return String(v??"").trim()}
function effectivePrice(line){const paid=Number(line.qty||0),bonus=Number(line.bonus||0),gross=Number(line.total??(paid*Number(line.price||0))),discount=Number(line.discount||0);return paid+bonus>0?Math.max(0,gross-discount)/(paid+bonus):0}
function invoiceFingerprint(parsed){return [norm(parsed.supplierName),norm(parsed.number),String(parsed.date||"").trim()].join("|")}
function showInvoicePreview(parsed,fileName){
  const rows=parsed.lines.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${money(x.qty)}</td><td>${esc(x.unit||"-")}</td><td>${money(x.price)}</td><td>${money(x.bonus)}</td><td>${money(effectivePrice(x))}</td><td>${esc(x.batch||"-")}</td><td>${esc(x.expiry||"-")}</td></tr>`).join("");
  $("#modalTitle").textContent="معاينة الفاتورة";
  $("#modalBody").innerHTML=`<div class="notice">الملف: ${esc(fileName)}<br>رقم الفاتورة: ${esc(parsed.number||"غير محدد")} · المورد: ${esc(parsed.supplierName||"غير محدد")} · التاريخ: ${esc(parsed.date||"غير محدد")}</div>${parsed.parseError?`<div class="notice">${esc(parsed.parseError)}</div>`:""}${parsed.lines.length?table(["م","الصنف","الكمية","الوحدة","سعر الشراء","البونص","السعر الفعلي بعد البونص","التشغيلة","الانتهاء"],rows):`<div class="notice">لم يتم استخراج أصناف صالحة. لا تعتمد هذا الملف قبل تعديل قالب الاستيراد.</div>`}<p class="muted">السعر الفعلي للوحدة = (إجمالي السطر − الخصم) ÷ (الكمية المدفوعة + البونص). يفترض النظام أن إجمالي السطر قبل الخصم؛ راجع الفاتورة إذا كان برنامج المورد يعرض إجمالياً بعد الخصم.</p>`;
  $("#modalActions").innerHTML=`<button type="button" class="btn" id="confirmImport" ${parsed.lines.length?"":"disabled"}>اعتماد الاستيراد</button><button type="button" class="btn secondary" id="cancelImport">إلغاء</button>`;
  $("#modal").showModal(); $("#cancelImport").onclick=closeModal;
  $("#confirmImport").onclick=async()=>{
    const fp=invoiceFingerprint(parsed),old=await all("invoices");
    if(parsed.number&&old.some(x=>x.fingerprint===fp||[norm(x.supplierName),norm(x.number),String(x.date||"")].join("|")===fp||[x.number,x.date,x.supplierName,x.total].join("|")===fp)){toast("توجد فاتورة بنفس المورد ورقم الفاتورة والتاريخ");return}
    try{
      const tx=db.transaction(["invoices","invoiceLines","audit"],"readwrite"),invStore=tx.objectStore("invoices"),lineStore=tx.objectStore("invoiceLines"),auditStore=tx.objectStore("audit");
      const request=invStore.add({...parsed,fingerprint:fp,importedAt:new Date().toISOString(),lineCount:parsed.lines.length});
      request.onsuccess=()=>{const invoiceId=request.result;for(const line of parsed.lines)lineStore.add({...line,invoiceId,invoiceNumber:parsed.number,supplierName:parsed.supplierName,date:parsed.date,effectivePrice:effectivePrice(line),shortageApplied:0});auditStore.add({action:"استيراد فاتورة",detail:`${parsed.number||fileName} - ${fileName}`,at:new Date().toISOString()})};
      await transactionDone(tx);closeModal();toast("تم استيراد الفاتورة بنجاح");renderInvoices($("#pageContent"));
    }catch(err){console.error(err);toast("فشل حفظ الفاتورة؛ لم يتم اعتماد أي جزء منها")}
  };
}
async function renderShortages(el){
  const [shorts]=await Promise.all([all("shortages")]);
  el.innerHTML=pageHead("إدارة النواقص","سجّل الاحتياج، ثم راجع المشتريات المطابقة وطبّق الكميات بعد التأكيد.",`<div class="inline-actions"><button class="btn secondary" id="matchPurchases">مراجعة المشتريات</button><button class="btn" id="addShortage">＋ إضافة نقص</button></div>`)+`<div class="toolbar"><div class="field search"><input id="shortSearch" placeholder="ابحث عن صنف..."></div></div><div id="shortTable"></div><div class="notice">لا تخصم المشتريات من النواقص تلقائياً. تتم المطابقة بالاسم والوحدة بعد مراجعتك وتأكيدك، ولا تتجاوز الكمية المتبقية المطلوبة.</div>`;
  const draw=()=>{const q=$("#shortSearch").value.toLowerCase();const list=shorts.filter(x=>x.name.toLowerCase().includes(q));$("#shortTable").innerHTML=table(["الصنف","الكمية المطلوبة","المشتَرى","المتبقي","الوحدة","الحالة","إجراء"],list.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${money(x.required)}</td><td>${money(x.purchased||0)}</td><td><span class="tag ${x.remaining>0?"amber":"green"}">${money(x.remaining)}</span></td><td>${esc(x.unit||"-")}</td><td>${x.remaining>0?"نشط":"مكتمل"}</td><td><button class="btn small secondary" data-edit="${x.id}">تعديل</button></td></tr>`).join(""))};
  $("#shortSearch").oninput=draw;draw();
  $("#addShortage").onclick=()=>showModal("إضافة صنف إلى النواقص",`<div class="grid-form">${field("اسم الصنف","name",true)}${field("الكمية المطلوبة","required",true)}${field("الوحدة","unit",true)}<div class="field wide"><label>ملاحظة</label><input name="note"></div></div>`,async()=>{const f=formValues(),required=Number(f.required);if(!f.name||!Number.isFinite(required)||required<=0||!f.unit)return toast("أدخل اسماً ووحدة وكمية أكبر من صفر");const same=shorts.find(x=>norm(x.name)===norm(f.name)&&norm(x.unit)===norm(f.unit)&&x.remaining>0);if(same){toast("الصنف موجود في النواقص بنفس الوحدة؛ عدّل الكمية بدلاً من التكرار");return}await add("shortages",{name:f.name,required,purchased:0,remaining:required,unit:f.unit,note:f.note,createdAt:new Date().toISOString()});await audit("إضافة نقص",f.name);closeModal();renderShortages(el)});
  $$("[data-edit]").forEach(b=>b.onclick=()=>{const x=shorts.find(a=>a.id==b.dataset.edit);showModal("تعديل النقص",`<div class="grid-form">${field("اسم الصنف","name",true)}${field("الكمية المطلوبة","required",true)}${field("الوحدة","unit",true)}</div>`,async()=>{const f=formValues(),required=Number(f.required);if(!f.name||!Number.isFinite(required)||required<=0||!f.unit)return toast("تحقق من الاسم والكمية والوحدة");const purchased=Number(x.purchased||0);await put("shortages",{...x,name:f.name,required,purchased,remaining:Math.max(0,required-purchased),unit:f.unit});await audit("تعديل النقص",x.name);closeModal();renderShortages(el)});$("#modalBody [name=name]").value=x.name;$("#modalBody [name=required]").value=x.required;$("#modalBody [name=unit]").value=x.unit});
  $("#matchPurchases").onclick=async()=>{
    const [freshShorts,lines]=await Promise.all([all("shortages"),all("invoiceLines")]);
    const candidates=[];
    for(const sh of freshShorts.filter(x=>x.remaining>0)) for(const line of lines){
      const available=Math.max(0,Number(line.qty||0)+Number(line.bonus||0)-Number(line.shortageApplied||0));
      if(available>0&&norm(line.name)===norm(sh.name)&&norm(line.unit)===norm(sh.unit)) candidates.push({shortageId:sh.id,lineId:line.id,name:sh.name,unit:sh.unit,available,invoice:line.invoiceNumber||"",supplier:line.supplierName||"",date:line.date||""});
    }
    if(!candidates.length){toast("لا توجد مشتريات غير موزعة تطابق الاسم والوحدة تماماً");return}
    const grouped=new Map();for(const c of candidates){const k=c.shortageId;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(c)}
    const html=[...grouped.entries()].map(([id,arr])=>{const sh=freshShorts.find(x=>x.id===id);return `<div class="panel"><b>${esc(sh.name)}</b> — المتبقي ${money(sh.remaining)} ${esc(sh.unit)}<div class="table-wrap"><table><thead><tr><th>المورد</th><th>الفاتورة</th><th>التاريخ</th><th>كمية متاحة</th><th>تطبيق</th></tr></thead><tbody>${arr.map(c=>`<tr><td>${esc(c.supplier)}</td><td>${esc(c.invoice)}</td><td>${esc(c.date)}</td><td>${money(c.available)}</td><td><label><input type="checkbox" class="match-line" data-shortage="${c.shortageId}" data-line="${c.lineId}" data-available="${c.available}" checked> تطبيق</label></td></tr>`).join("")}</tbody></table></div></div>`}).join("");
    $("#modalTitle").textContent="مراجعة مشتريات النواقص";$("#modalBody").innerHTML=`<div class="notice">سيتم توزيع المشتريات المحددة على النواقص المطابقة. لن تتجاوز الكمية المطبقة المتبقي، ولن تُستخدم الكمية نفسها مرتين.</div>${html}`;$("#modalActions").innerHTML=`<button type="button" class="btn" id="applyMatches">تأكيد تطبيق المطابقة</button><button type="button" class="btn secondary" id="cancelMatches">إلغاء</button>`;$("#modal").showModal();$("#cancelMatches").onclick=closeModal;
    $("#applyMatches").onclick=async()=>{try{
      const selected=$$(".match-line:checked");if(!selected.length)return toast("حدد عملية مطابقة واحدة على الأقل");
      const [currentShortages,currentLines]=await Promise.all([all("shortages"),all("invoiceLines")]);
      const shortageMap=new Map(currentShortages.map(x=>[x.id,{...x}])),lineMap=new Map(currentLines.map(x=>[x.id,{...x}]));let appliedCount=0;
      for(const cb of selected){const sh=shortageMap.get(Number(cb.dataset.shortage)),line=lineMap.get(Number(cb.dataset.line));if(!sh||!line||norm(line.name)!==norm(sh.name)||norm(line.unit)!==norm(sh.unit))continue;
        const remaining=Math.max(0,Number(sh.required)-Number(sh.purchased||0)),available=Math.max(0,Number(line.qty||0)+Number(line.bonus||0)-Number(line.shortageApplied||0)),applied=Math.min(remaining,available);
        if(applied<=0)continue;sh.purchased=Number(sh.purchased||0)+applied;sh.remaining=Math.max(0,Number(sh.required)-sh.purchased);line.shortageApplied=Number(line.shortageApplied||0)+applied;appliedCount++;
      }
      if(!appliedCount)return toast("لم تعد هناك كميات متاحة للتطبيق؛ أعد تحميل المطابقة");
      const tx=db.transaction(["shortages","invoiceLines","audit"],"readwrite"),ss=tx.objectStore("shortages"),ls=tx.objectStore("invoiceLines"),as=tx.objectStore("audit");
      for(const sh of shortageMap.values())ss.put(sh);for(const line of lineMap.values())ls.put(line);
      as.add({action:"مطابقة مشتريات مع النواقص",detail:`عدد عمليات المطابقة: ${appliedCount}`,at:new Date().toISOString()});await transactionDone(tx);
      closeModal();toast("تم تطبيق المطابقة المحددة");renderShortages(el);
    }catch(err){console.error(err);toast("تعذر تطبيق المطابقة؛ لم يتم اعتماد العملية")}};
  };
}
async function renderCompare(el){
  const [lines,items]=await Promise.all([all("invoiceLines"),all("items")]);
  const itemMap=new Map(items.map(x=>[norm(x.name),x]));
  const priced=lines.map(l=>{const item=itemMap.get(norm(l.name));const sameUnit=item&&norm(item.unit)===norm(l.unit);const factor=sameUnit?Math.max(1,Number(item.factor)||1):1;return {...l,comparisonUnit:sameUnit?(item.baseUnit||l.unit):l.unit,comparisonFactor:factor,comparisonEffective:effectivePrice(l)/factor,comparisonOriginal:Number(l.price||0)/factor,conversionKnown:!!sameUnit}});
  el.innerHTML=pageHead("مقارنة الأسعار","يعرض سعر الشراء الأصلي والسعر الفعلي بعد البونص. يطبق معامل التحويل فقط عند تطابق وحدة الفاتورة مع وحدة الشراء المسجلة للصنف.")+`<div class="toolbar"><div class="field search"><input id="compareSearch" placeholder="ابحث عن الصنف..."></div><div class="field"><select id="priceMode"><option value="effective">الأقل بعد احتساب البونص</option><option value="original">الأقل حسب سعر الشراء</option></select></div></div><div id="compareTable"></div><div class="notice">لا تقارن أسعار عبوات مختلفة إلا بعد تعريف وحدة الشراء ومعامل التحويل الصحيح في قاعدة الأصناف. عند عدم تطابق الوحدة، يعرض النظام السعر بوحدة الفاتورة دون تحويل.</div>`;
  const draw=()=>{const q=$("#compareSearch").value.toLowerCase(),mode=$("#priceMode").value;const key=mode==="effective"?"comparisonEffective":"comparisonOriginal";const rows=priced.filter(l=>l.name.toLowerCase().includes(q)).sort((a,b)=>a[key]-b[key]);$("#compareTable").innerHTML=table(["الصنف","المورد","سعر الشراء الأصلي","البونص","السعر الفعلي","وحدة المقارنة","التاريخ"],rows.map(l=>`<tr><td><b>${esc(l.name)}</b></td><td>${esc(l.supplierName||"-")}</td><td>${money(l.price)}</td><td>${money(l.bonus)}</td><td class="price-good">${money(l.comparisonEffective)}</td><td>${esc(l.comparisonUnit||"-")}${l.conversionKnown?` <span class="tag green">محول</span>`:` <span class="tag amber">غير محول</span>`}</td><td>${esc(l.date||"-")}</td></tr>`).join(""))};$("#compareSearch").oninput=draw;$("#priceMode").onchange=draw;draw();
}
async function renderOrders(el){
  const orders=await all("orders"),shorts=await all("shortages");
  el.innerHTML=pageHead("طلبيات الشراء","أنشئ مسودة طلبية من الكميات المتبقية في قائمة النواقص.",`<button class="btn" id="newOrder">＋ إنشاء طلبية من النواقص</button>`)+`<div class="panel"><h3>الطلبيات المحفوظة</h3>${table(["رقم الطلبية","التاريخ","الحالة","عدد الأصناف","إجمالي الكميات"],orders.slice().reverse().map(x=>`<tr><td>${esc(x.number)}</td><td>${esc(x.date)}</td><td><span class="tag">${esc(x.status)}</span></td><td>${x.lines?.length||0}</td><td>${money((x.lines||[]).reduce((s,l)=>s+Number(l.qty||0),0))}</td></tr>`).join(""))}</div>`;
  $("#newOrder").onclick=async()=>{const active=shorts.filter(x=>Number(x.remaining)>0);if(!active.length){toast("لا توجد نواقص متبقية لإنشاء طلبية");return}const n=`ORD-${String(Math.max(0,...orders.map(x=>Number(String(x.number||"").split("-").pop())||0))+1).padStart(3,"0")}`;const lines=active.map(x=>({shortageId:x.id,name:x.name,qty:Number(x.remaining),unit:x.unit,note:x.note||""}));await add("orders",{number:n,date:today(),status:"مسودة",lines,createdAt:new Date().toISOString()});await audit("إنشاء طلبية من النواقص",n);toast(`تم إنشاء ${n} وبها ${lines.length} صنفاً`);renderOrders(el)};
}
async function renderSuppliers(el){const sups=await all("suppliers");el.innerHTML=pageHead("الموردون","إدارة دليل الموردين.",`<button class="btn" id="addSupplier">＋ إضافة مورد</button>`)+table(["اسم المورد","الهاتف","العنوان","ملاحظات"],sups.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.phone||"-")}</td><td>${esc(x.address||"-")}</td><td>${esc(x.note||"-")}</td></tr>`).join(""));$("#addSupplier").onclick=()=>showModal("إضافة مورد",`<div class="grid-form">${field("اسم المورد","name",true)}${field("الهاتف","phone")}${field("العنوان","address")}<div class="field wide"><label>ملاحظات</label><input name="note"></div></div>`,async()=>{const f=formValues();if(!f.name)return toast("أدخل اسم المورد");await add("suppliers",f);await audit("إضافة مورد",f.name);closeModal();renderSuppliers(el)})}
async function renderHistory(el){const [invs,lines]=await Promise.all([all("invoices"),all("invoiceLines")]);el.innerHTML=pageHead("سجل المشتريات","سجل الفواتير والأصناف وأسعارها التاريخية.")+`<div class="panel"><h3>الفواتير</h3>${table(["رقم الفاتورة","المورد","التاريخ","عدد الأصناف","الإجمالي"],invs.slice().reverse().map(x=>`<tr><td>${esc(x.number||"-")}</td><td>${esc(x.supplierName||"-")}</td><td>${esc(x.date||"-")}</td><td>${x.lineCount}</td><td>${money(x.total)}</td></tr>`).join(""))}</div><div class="panel"><h3>تفاصيل الأصناف</h3>${table(["الصنف","المورد","الكمية","سعر الشراء","البونص","السعر الفعلي","التشغيلة","الانتهاء"],lines.slice().reverse().map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.supplierName||"-")}</td><td>${money(x.qty)} ${esc(x.unit)}</td><td>${money(x.price)}</td><td>${money(x.bonus)}</td><td class="price-good">${money(x.effectivePrice)}</td><td>${esc(x.batch||"-")}</td><td>${esc(x.expiry||"-")}</td></tr>`).join(""))}</div>`}
async function renderBackup(el){
  el.innerHTML=pageHead("النسخ الاحتياطي","تصدير بيانات النظام إلى JSON أو استعادة نسخة سابقة بعد التحقق منها.")+`<div class="panel"><h3>تصدير نسخة احتياطية</h3><p class="muted">يشمل الأصناف والموردين والفواتير وتفاصيلها والنواقص والطلبيات وسجل التدقيق.</p><button class="btn" id="exportBackup">تنزيل النسخة الاحتياطية</button></div><div class="panel"><h3>استعادة نسخة احتياطية</h3><div class="notice">الاستعادة تستبدل البيانات الحالية بالكامل. صدّر نسخة حديثة قبل المتابعة.</div><label class="file-label">اختيار ملف JSON <input type="file" id="restoreFile" accept=".json"></label><button class="btn danger" id="restoreBackup">استعادة البيانات</button></div>`;
  let restore=null;
  $("#exportBackup").onclick=async()=>{try{const data={app:"PharmacyHezam",version:1,exportedAt:new Date().toISOString(),stores:{}};for(const n of STORE_NAMES)data.stores[n]=await all(n);download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`pharmacy-backup-${today()}.json`);toast("تم تجهيز النسخة الاحتياطية")}catch(err){console.error(err);toast("تعذر إنشاء النسخة الاحتياطية")}};
  $("#restoreFile").onchange=async e=>{try{const file=e.target.files?.[0];if(!file)throw Error();const parsed=JSON.parse(await file.text());if(parsed.version!==1||!parsed.stores||!STORE_NAMES.every(n=>Array.isArray(parsed.stores[n])))throw Error("invalid backup");for(const n of STORE_NAMES)for(const item of parsed.stores[n])if(!item||typeof item!=="object"||Array.isArray(item))throw Error("invalid record");restore=parsed;toast("تم التحقق من ملف النسخة وبنية جميع الجداول")}catch{restore=null;toast("ملف النسخة غير صالح أو غير متوافق")}};
  $("#restoreBackup").onclick=async()=>{if(!restore)return toast("اختر ملف نسخة صالحاً أولاً");if(!confirm("سيتم استبدال جميع البيانات الحالية. هل صدّرت نسخة احتياطية وتريد المتابعة؟"))return;try{const tx=db.transaction([...STORE_NAMES],"readwrite");for(const n of STORE_NAMES){const st=tx.objectStore(n);st.clear();for(const item of restore.stores[n])st.put(item)}await transactionDone(tx);await audit("استعادة نسخة احتياطية",restore.exportedAt||"");toast("تمت استعادة البيانات بنجاح");renderBackup(el)}catch(err){console.error(err);toast("فشلت الاستعادة؛ تحقق من توافق النسخة وحاول مجدداً")}};
}
function download(blob,name){const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("#navigation").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)navigate(b.dataset.page)});$("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
(async()=>{try{db=await openDB();await navigate("dashboard")}catch(e){console.error(e);toast("تعذر تشغيل قاعدة البيانات المحلية")}})();

