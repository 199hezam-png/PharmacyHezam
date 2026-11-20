/* Pharmacy Manager - local-first implementation (Updated for Modern Soft + Smart Orders) */
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
 invoices:["استيراد الفواتير","استيراد فواتير مودرن سوفت وملفات Excel ومراجعتها قبل الحفظ"],
 shortages:["إدارة النواقص","تسجيل الاحتياج ومتابعة الكميات المتبقية"],
 compare:["مقارنة الأسعار","مقارنة سعر الشراء الأصلي والتكلفة الفعلية بعد البونص"],
 orders:["طلبيات الشراء","تجهيز الطلبيات واختيار أقل سعر والتجميع حسب المورد"],
 suppliers:["الموردون","دليل الموردين"],
 history:["سجل المشتريات","الفواتير والأصناف المستوردة"],
 backup:["النسخ الاحتياطي","تصدير قاعدة البيانات أو استعادتها"]
};

let currentPage="dashboard";
let activeOrderId=null;

async function navigate(page){
  currentPage=page;
  $("#pageTitle").textContent=pages[page][0];
  $("#pageSubtitle").textContent=pages[page][1];
  $$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#sidebar").classList.remove("open");
  await render();
}
function pageHead(title,desc,action=""){return `<div class="page-head no-print"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">لا توجد بيانات لعرضها حالياً</td></tr>`}</tbody></table></div>`}

async function render(){
  const el=$("#pageContent");
  switch(currentPage){
    case"dashboard":return renderDashboard(el);
    case"items":return renderItems(el);
    case"invoices":return renderInvoices(el);
    case"shortages":return renderShortages(el);
    case"compare":return renderCompare(el);
    case"orders":return renderOrders(el);
    case"suppliers":return renderSuppliers(el);
    case"history":return renderHistory(el);
    case"backup":return renderBackup(el);
  }
}

async function renderDashboard(el){
  const [items,sups,invs,shorts]=await Promise.all(["items","suppliers","invoices","shortages"].map(all));
  el.innerHTML=`
<div class="cards">
<div class="stat-card"><div class="label">إجمالي الأصناف</div><div class="value">${money(items.length)}</div><div class="hint">في قاعدة البيانات المحلية</div></div>
<div class="stat-card"><div class="label">الموردون</div><div class="value">${money(sups.length)}</div><div class="hint">الموردون المسجلون</div></div>
<div class="stat-card"><div class="label">فواتير المشتريات</div><div class="value">${money(invs.length)}</div><div class="hint">الفواتير المستوردة</div></div>
<div class="stat-card"><div class="label">النواقص النشطة</div><div class="value">${money(shorts.filter(x=>x.remaining>0).length)}</div><div class="hint">أصناف تحتاج إلى شراء</div></div>
</div>
<div class="panel"><h3>الوصول السريع</h3><div class="quick-grid">
<button class="quick" data-go="invoices"><b>⇧ استيراد فاتورة</b><span>ملفات مودرن سوفت أو Excel</span></button>
<button class="quick" data-go="orders"><b>▣ طلبية شراء</b><span>اختيار أقل سعر والتجميع حسب المورد</span></button>
<button class="quick" data-go="shortages"><b>＋ إضافة نقص</b><span>تسجيل صنف وكمية مطلوبة</span></button>
<button class="quick" data-go="compare"><b>⇄ مقارنة الأسعار</b><span>معرفة أقل تكلفة فعلية</span></button>
</div></div>
<div class="panel"><h3>آخر الفواتير المستوردة</h3>${table(["رقم الفاتورة","المورد","التاريخ","عدد الأصناف","الإجمالي"],invs.slice(-5).reverse().map(x=>`<tr><td>${esc(x.number||"-")}</td><td>${esc(x.supplierName||"-")}</td><td>${esc(x.date||"-")}</td><td>${x.lineCount||0}</td><td>${money(x.total||0)}</td></tr>`).join(""))}</div>
<div class="notice">تنبيه: البيانات محفوظة محلياً داخل المتصفح. احتفظ بنسخة احتياطية دورية من قسم "النسخ الاحتياطي".</div>`;
  $$("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));
}

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

/* ==================== INVOICES IMPORT (MODERN SOFT + STANDARD) ==================== */
async function renderInvoices(el){
  const invs=await all("invoices");
  el.innerHTML=pageHead("استيراد الفواتير","يدعم تقارير فواتير مودرن سوفت المتعددة وملفات Excel القياسية (XLS / XLSX).")+`
<div class="panel"><div class="dropzone"><strong>اختر ملف فواتير Excel</strong><p>يمكنك اختيار ملف يحتوي على فاتورة واحدة أو عدة فواتير متتالية من مودرن سوفت.</p><label class="file-label">اختيار ملف <input type="file" id="invoiceFile" accept=".xls,.xlsx"></label></div><div id="importPreview"></div></div>
<div class="panel"><h3>الفواتير المستوردة (${invs.length})</h3>${table(["رقم الفاتورة","المورد","التاريخ","الأصناف","الإجمالي"],invs.slice().reverse().map(x=>`<tr><td>${esc(x.number||"-")}</td><td>${esc(x.supplierName||"-")}</td><td>${esc(x.date||"-")}</td><td>${x.lineCount||0}</td><td>${money(x.total||0)}</td></tr>`).join(""))}</div>`;
  $("#invoiceFile").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const data=await file.arrayBuffer();
      const wb=XLSX.read(data,{type:"array",cellDates:true});
      const sheet=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false});
      const parsedList=parseInvoicesFromRows(rows,file.name);
      showInvoicesPreview(parsedList,file.name);
    }catch(err){console.error(err);toast("تعذر قراءة الملف. تأكد من سلامة ملف Excel.")}
    e.target.value="";
  };
}

function norm(v){return String(v??"").toLowerCase().replace(/[أإآ]/g,"ا").replace(/[ى]/g,"ي").replace(/[ًٌٍَُِّْ\u0640]/g,"").replace(/\s+/g," ").trim()}

function findAdjacentValue(row, labelIdx){
  // Modern Soft RTL sheets often place the value to the LEFT (lower index) of the label, while standard sheets place it to the RIGHT
  for(let j=labelIdx-1;j>=Math.max(0,labelIdx-8);j--){
    const v=String(row[j]??"").trim();
    if(v && !v.startsWith(":")) return v;
  }
  for(let j=labelIdx+1;j<Math.min(row.length,labelIdx+5);j++){
    const v=String(row[j]??"").trim();
    if(v && !v.startsWith(":")) return v;
  }
  return "";
}

function parseInvoicesFromRows(rows,fileName){
  const invoices=[];
  let meta={number:"",date:"",supplierName:"",warehouse:"",fileName};
  let inTable=false;
  let ix=null;
  let currentLines=[];

  const pushCurrent=()=>{
    if(currentLines.length>0){
      invoices.push({...meta,lines:currentLines,total:currentLines.reduce((s,x)=>s+x.total,0)});
    }
    currentLines=[];
    inTable=false;
    ix=null;
  };

  for(let i=0;i<rows.length;i++){
    const row=rows[i];
    if(!row||row.every(c=>String(c??"").trim()==="")) continue;
    const normRow=row.map(norm);

    if(!inTable){
      // Extract metadata from Modern Soft or standard headers
      for(let c=0;c<normRow.length;c++){
        const cell=normRow[c];
        if(cell.includes("رقم الفاتور")||cell==="invoice no"||cell==="invoice number"){
          const val=findAdjacentValue(row,c);if(val) meta.number=val;
        } else if(cell.includes("التاريخ")||cell.includes("تاريخ الفاتور")||cell==="date"){
          const val=findAdjacentValue(row,c);if(val) meta.date=formatDate(val);
        } else if(cell.includes("اسم المورد")||cell==="المورد"||cell==="supplier"){
          const val=findAdjacentValue(row,c);if(val) meta.supplierName=val;
        } else if(cell.includes("العنوان") && !cell.includes("ت:")){
          // In Modern Soft, supplier name sits between :العنــوان and :ملاحظـات
          for(let k=c+1;k<row.length;k++){
            const v=String(row[k]??"").trim();
            const nv=norm(v);
            if(v && !nv.includes("ملاحظات") && !nv.includes("ت:") && !nv.includes("فاكس")){
              meta.supplierName=v;break;
            }
          }
        }
      }
    }

    // Detect table header row
    const idx=terms=>normRow.findIndex(h=>terms.some(t=>h===norm(t)||h.includes(norm(t))));
    const fName=idx(["اسم الصنف","الصنف","item name","item","البيان"]);
    const fPrice=idx(["سعر الوحدة","السعر","سعر","price"]);
    const fQty=idx(["الكمية","الكميه","كمية","quantity","qty"]);

    if(fName>=0 && fPrice>=0 && fQty>=0){
      if(currentLines.length>0) pushCurrent();
      ix={
        name:fName,qty:fQty,price:fPrice,
        unit:idx(["الوحدة","الوحده","unit"]),
        bonus:idx(["البونص","بونص","bonus"]),
        discount:idx(["التخفيض","الخصم","discount"]),
        batch:idx(["رقم التشغيلة","التشغيلة","batch"]),
        expiry:idx(["تاريخ الانتهاء","الانتهاء","expiry"]),
        total:idx(["القيمة","القيمه","اجمالي السطر","الاجمالي","المجموع","total"])
      };
      inTable=true;
      continue;
    }

    if(inTable && ix){
      // Detect end of invoice table
      const isEnd=normRow.some(c=>c.includes("الاجمالي")||c.includes("إلإجمالي")||c.includes("المستلم")||c.includes("مودرن سوفت")||c.includes("رقم الفاتور"));
      if(isEnd){
        pushCurrent();
        meta={number:"",date:"",supplierName:"",warehouse:"",fileName};
        continue;
      }

      const rawName=row[ix.name];
      if(!String(rawName??"").trim()) continue;
      const qty=num(row[ix.qty]),price=num(row[ix.price]);
      if(qty<=0||price<0) continue;

      const bonus=ix.bonus>=0?num(row[ix.bonus]):0;
      const discount=ix.discount>=0?num(row[ix.discount]):0;
      const explicitTotal=ix.total>=0?num(row[ix.total]):0;

      // Handle shifted merged unit cell in Modern Soft (header at col 17, value at col 18)
      let unit="";
      if(ix.unit>=0){
        const u=String(row[ix.unit]||"").trim()||String(row[ix.unit+1]||"").trim()||String(row[ix.unit-1]||"").trim();
        if(u && isNaN(Number(u))) unit=u;
      }

      currentLines.push({
        name:String(rawName).trim(),
        qty,unit,price,bonus,discount,
        batch:ix.batch>=0?String(row[ix.batch]||"").trim():"",
        expiry:ix.expiry>=0?formatDate(row[ix.expiry]):"",
        total:explicitTotal>0?explicitTotal:qty*price,
        totalIncludesDiscount:false
      });
    }
  }
  if(currentLines.length>0) pushCurrent();
  return invoices;
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

function showInvoicesPreview(parsedList,fileName){
  const totalLines=parsedList.reduce((s,inv)=>s+inv.lines.length,0);
  const bodyHtml=parsedList.length?parsedList.map((inv,idx)=>{
    const rows=inv.lines.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.name)}</td><td>${money(x.qty)}</td><td>${esc(x.unit||"-")}</td><td>${money(x.price)}</td><td>${money(x.bonus)}</td><td class="price-good">${money(effectivePrice(x))}</td><td>${esc(x.expiry||"-")}</td></tr>`).join("");
    return `<div class="panel"><b>فاتورة #${idx+1}: رقم ${esc(inv.number||"غير محدد")} · المورد: ${esc(inv.supplierName||"غير محدد")} · التاريخ: ${esc(inv.date||"-")}</b>${table(["م","الصنف","الكمية","الوحدة","السعر","البونص","الفعلي","الانتهاء"],rows)}</div>`;
  }).join(""):`<div class="notice">لم يتم العثور على فواتير أو أصناف صالحة في هذا الملف.</div>`;

  $("#modalTitle").textContent=`معاينة الاستيراد (${parsedList.length} فاتورة · ${totalLines} صنف)`;
  $("#modalBody").innerHTML=`<div class="notice">الملف: ${esc(fileName)} — تم اكتشاف <b>${parsedList.length}</b> فاتورة بإجمالي <b>${totalLines}</b> حركة صنف.</div>${bodyHtml}`;
  $("#modalActions").innerHTML=`<button type="button" class="btn" id="confirmImport" ${totalLines?"":"disabled"}>اعتماد استيراد الكل</button><button type="button" class="btn secondary" id="cancelImport">إلغاء</button>`;
  $("#modal").showModal(); $("#cancelImport").onclick=closeModal;

  $("#confirmImport").onclick=async()=>{
    const old=await all("invoices");
    const existingFps=new Set(old.map(x=>x.fingerprint||invoiceFingerprint(x)));
    const toImport=parsedList.filter(p=>!(p.number && existingFps.has(invoiceFingerprint(p))));
    if(!toImport.length){toast("جميع الفواتير في هذا الملف مستوردة مسبقاً");return}
    try{
      const tx=db.transaction(["invoices","invoiceLines","audit"],"readwrite");
      const invStore=tx.objectStore("invoices"),lineStore=tx.objectStore("invoiceLines"),auditStore=tx.objectStore("audit");
      for(const parsed of toImport){
        const fp=invoiceFingerprint(parsed);
        const req=invStore.add({...parsed,fingerprint:fp,importedAt:new Date().toISOString(),lineCount:parsed.lines.length});
        req.onsuccess=()=>{
          const invoiceId=req.result;
          for(const line of parsed.lines){
            lineStore.add({...line,invoiceId,invoiceNumber:parsed.number,supplierName:parsed.supplierName||"مورد غير محدد",date:parsed.date,effectivePrice:effectivePrice(line),shortageApplied:0});
          }
        };
      }
      auditStore.add({action:"استيراد فواتير",detail:`${fileName} (${toImport.length} فاتورة)`,at:new Date().toISOString()});
      await transactionDone(tx);
      closeModal();
      toast(`تم استيراد ${toImport.length} فاتورة بنجاح`);
      renderInvoices($("#pageContent"));
    }catch(err){console.error(err);toast("فشل حفظ الفواتير")}
  };
}

/* ==================== SHORTAGES ==================== */
async function renderShortages(el){
  const [shorts]=await Promise.all([all("shortages")]);
  el.innerHTML=pageHead("إدارة النواقص","سجّل الاحتياج، ثم راجع المشتريات المطابقة وطبّق الكميات بعد التأكيد.",`<div class="inline-actions"><button class="btn secondary" id="matchPurchases">مراجعة المشتريات</button><button class="btn" id="addShortage">＋ إضافة نقص</button></div>`)+`<div class="toolbar"><div class="field search"><input id="shortSearch" placeholder="ابحث عن صنف..."></div></div><div id="shortTable"></div><div class="notice">لا تخصم المشتريات من النواقص تلقائياً. تتم المطابقة بالاسم والوحدة بعد مراجعتك وتأكيدك.</div>`;
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
    $("#modalTitle").textContent="مراجعة مشتريات النواقص";$("#modalBody").innerHTML=`<div class="notice">سيتم توزيع المشتريات المحددة على النواقص المطابقة.</div>${html}`;$("#modalActions").innerHTML=`<button type="button" class="btn" id="applyMatches">تأكيد تطبيق المطابقة</button><button type="button" class="btn secondary" id="cancelMatches">إلغاء</button>`;$("#modal").showModal();$("#cancelMatches").onclick=closeModal;
    $("#applyMatches").onclick=async()=>{try{
      const selected=$$(".match-line:checked");if(!selected.length)return toast("حدد عملية مطابقة واحدة على الأقل");
      const [currentShortages,currentLines]=await Promise.all([all("shortages"),all("invoiceLines")]);
      const shortageMap=new Map(currentShortages.map(x=>[x.id,{...x}])),lineMap=new Map(currentLines.map(x=>[x.id,{...x}]));let appliedCount=0;
      for(const cb of selected){const sh=shortageMap.get(Number(cb.dataset.shortage)),line=lineMap.get(Number(cb.dataset.line));if(!sh||!line||norm(line.name)!==norm(sh.name)||norm(line.unit)!==norm(sh.unit))continue;
        const remaining=Math.max(0,Number(sh.required)-Number(sh.purchased||0)),available=Math.max(0,Number(line.qty||0)+Number(line.bonus||0)-Number(line.shortageApplied||0)),applied=Math.min(remaining,available);
        if(applied<=0)continue;sh.purchased=Number(sh.purchased||0)+applied;sh.remaining=Math.max(0,Number(sh.required)-sh.purchased);line.shortageApplied=Number(line.shortageApplied||0)+applied;appliedCount++;
      }
      if(!appliedCount)return toast("لم تعد هناك كميات متاحة للتطبيق");
      const tx=db.transaction(["shortages","invoiceLines","audit"],"readwrite"),ss=tx.objectStore("shortages"),ls=tx.objectStore("invoiceLines"),as=tx.objectStore("audit");
      for(const sh of shortageMap.values())ss.put(sh);for(const line of lineMap.values())ls.put(line);
      as.add({action:"مطابقة مشتريات مع النواقص",detail:`عدد عمليات المطابقة: ${appliedCount}`,at:new Date().toISOString()});await transactionDone(tx);
      closeModal();toast("تم تطبيق المطابقة المحددة");renderShortages(el);
    }catch(err){console.error(err);toast("تعذر تطبيق المطابقة")}};
  };
}

/* ==================== COMPARE PRICES ==================== */
async function renderCompare(el){
  const [lines,items]=await Promise.all([all("invoiceLines"),all("items")]);
  const itemMap=new Map(items.map(x=>[norm(x.name),x]));
  const freqMap=new Map();
  for(const l of lines){const k=norm(l.name);freqMap.set(k,(freqMap.get(k)||0)+1);}

  const priced=lines.map(l=>{
    const item=itemMap.get(norm(l.name));
    const sameUnit=item&&norm(item.unit)===norm(l.unit);
    const factor=sameUnit?Math.max(1,Number(item.factor)||1):1;
    return {...l,freq:freqMap.get(norm(l.name))||1,comparisonUnit:sameUnit?(item.baseUnit||l.unit):l.unit,comparisonFactor:factor,comparisonEffective:effectivePrice(l)/factor,comparisonOriginal:Number(l.price||0)/factor,conversionKnown:!!sameUnit};
  });
  el.innerHTML=pageHead("مقارنة الأسعار","يعرض سعر الشراء الأصلي والسعر الفعلي بعد البونص وعدد مرات طلب الصنف.")+`<div class="toolbar"><div class="field search"><input id="compareSearch" placeholder="ابحث عن الصنف..."></div><div class="field"><select id="priceMode"><option value="effective">الأقل بعد احتساب البونص</option><option value="original">الأقل حسب سعر الشراء</option></select></div></div><div id="compareTable"></div>`;
  const draw=()=>{
    const q=norm($("#compareSearch").value),mode=$("#priceMode").value;
    const key=mode==="effective"?"comparisonEffective":"comparisonOriginal";
    const rows=priced.filter(l=>norm(l.name).includes(q)).sort((a,b)=>a[key]-b[key]);
    $("#compareTable").innerHTML=table(["الصنف","المورد","سعر الشراء","البونص","السعر الفعلي","مرات الطلب","وحدة المقارنة","التاريخ"],rows.map(l=>`<tr><td><b>${esc(l.name)}</b></td><td>${esc(l.supplierName||"-")}</td><td>${money(l.price)}</td><td>${money(l.bonus)}</td><td class="price-good">${money(l.comparisonEffective)}</td><td><span class="tag amber">${l.freq} مرات</span></td><td>${esc(l.comparisonUnit||"-")}</td><td>${esc(l.date||"-")}</td></tr>`).join(""));
  };
  $("#compareSearch").oninput=draw;$("#priceMode").onchange=draw;draw();
}

/* ==================== SMART PURCHASE ORDERS ==================== */
function buildOffersIndex(lines){
  const map=new Map();
  for(const l of lines){
    const key=`${norm(l.name)}|||${norm(l.unit)}`;
    const sup=l.supplierName||"مورد غير محدد";
    const eff=effectivePrice(l);
    if(!map.has(key)) map.set(key,{name:l.name,unit:l.unit||"أساسي",totalCount:0,minPrice:eff,bestSupplier:sup,suppliers:{}});
    const entry=map.get(key);
    entry.totalCount+=1;
    if(eff<entry.minPrice){entry.minPrice=eff;entry.bestSupplier=sup;}
    if(!entry.suppliers[sup]){
      entry.suppliers[sup]={supplier:sup,minPrice:eff,lastPrice:eff,count:1,lastDate:l.date||""};
    }else{
      entry.suppliers[sup].count+=1;
      entry.suppliers[sup].lastPrice=eff;
      if(eff<entry.suppliers[sup].minPrice) entry.suppliers[sup].minPrice=eff;
      if(l.date) entry.suppliers[sup].lastDate=l.date;
    }
  }
  return map;
}

async function renderOrders(el){
  const [orders,shorts,lines]=await Promise.all([all("orders"),all("shortages"),all("invoiceLines")]);
  const offersMap=buildOffersIndex(lines);

  if(activeOrderId && !orders.some(o=>o.id===activeOrderId)) activeOrderId=null;
  if(!activeOrderId && orders.length) activeOrderId=orders[orders.length-1].id;
  const activeOrder=orders.find(o=>o.id===activeOrderId)||null;

  const nextOrderNumber=()=>`ORD-${String(Math.max(0,...orders.map(x=>Number(String(x.number||"").split("-").pop())||0))+1).padStart(3,"0")}`;

  el.innerHTML=pageHead("طلبيات الشراء","ابحث عن الصنف لاختيار أقل سعر ومورد، مع تجميع تلقائي حسب المورد وطباعة PDF.",`
    <div class="inline-actions">
      <button class="btn secondary" id="newBlankOrder">＋ طلبية فارغة جديدة</button>
      <button class="btn" id="newOrderFromShorts">＋ طلبية من النواقص</button>
    </div>`)+`
    <div class="panel no-print">
      <div class="toolbar" style="align-items:center;justify-content:space-between;margin-bottom:0">
        <div class="field" style="min-width:240px">
          <label>اختر الطلبية الحالية (${orders.length})</label>
          <select id="orderSelect">
            ${orders.length?orders.slice().reverse().map(o=>`<option value="${o.id}" ${o.id===activeOrderId?"selected":""}>${esc(o.number)} — ${esc(o.date)} (${o.lines?.length||0} أصناف)</option>`).join(""):`<option value="">لا توجد طلبيات بعد</option>`}
          </select>
        </div>
        ${activeOrder?`<div class="inline-actions">
          <button class="btn" id="printOrderBtn">🖨 طباعة الطلبية (PDF)</button>
          <button class="btn danger small" id="deleteOrderBtn">حذف الطلبية</button>
        </div>`:""}
      </div>
    </div>
    ${activeOrder?`
    <div class="panel no-print">
      <h3>إضافة صنف للطلبية (${esc(activeOrder.number)}) — اختيار أقل سعر</h3>
      <div class="grid-form">
        <div class="field" style="grid-column:span 2">
          <label>اكتب اسم الصنف لعرض خيارات الشراء والموردين</label>
          <input id="ordItemSearch" placeholder="ابحث باسم الصنف...">
        </div>
        <div class="field">
          <label>الكمية المطلوبة</label>
          <input id="ordItemQty" type="number" min="1" value="1">
        </div>
      </div>
      <div id="ordOptionsBox" class="options-grid" style="margin-top:12px"></div>
    </div>
    <div id="orderPrintArea" class="print-full"></div>
    `:`<div class="panel empty">اضغط على "طلبية فارغة جديدة" أو "طلبية من النواقص" للبدء.</div>`}`;

  $("#newBlankOrder").onclick=async()=>{
    const n=nextOrderNumber();
    const id=await add("orders",{number:n,date:today(),status:"مسودة",lines:[],createdAt:new Date().toISOString()});
    activeOrderId=id;await audit("إنشاء طلبية فارغة",n);toast(`تم إنشاء الطلبية ${n}`);renderOrders(el);
  };

  $("#newOrderFromShorts").onclick=async()=>{
    const active=shorts.filter(x=>Number(x.remaining)>0);
    if(!active.length){toast("لا توجد نواقص متبقية لإنشاء طلبية");return}
    const n=nextOrderNumber();
    const orderLines=active.map(x=>{
      const match=offersMap.get(`${norm(x.name)}|||${norm(x.unit)}`);
      return {shortageId:x.id,name:x.name,qty:Number(x.remaining),unit:x.unit||"أساسي",supplier:match?match.bestSupplier:"غير محدد",price:match?match.minPrice:0,note:x.note||""};
    });
    const id=await add("orders",{number:n,date:today(),status:"مسودة",lines:orderLines,createdAt:new Date().toISOString()});
    activeOrderId=id;await audit("إنشاء طلبية من النواقص",n);toast(`تم إنشاء ${n} وبها ${orderLines.length} صنفاً`);renderOrders(el);
  };

  if(!activeOrder) return;

  $("#orderSelect").onchange=e=>{activeOrderId=Number(e.target.value);renderOrders(el)};
  $("#printOrderBtn").onclick=()=>window.print();
  $("#deleteOrderBtn").onclick=async()=>{if(confirm(`حذف الطلبية ${activeOrder.number}؟`)){await remove("orders",activeOrder.id);activeOrderId=null;renderOrders(el)}};

  // Render Purchase Options on typing
  $("#ordItemSearch").oninput=()=>{
    const q=norm($("#ordItemSearch").value);
    const box=$("#ordOptionsBox");
    if(!q){box.innerHTML="";return}

    const offers=[];
    for(const entry of offersMap.values()){
      if(norm(entry.name).includes(q)){
        for(const s of Object.values(entry.suppliers)){
          offers.push({name:entry.name,unit:entry.unit,supplier:s.supplier,price:s.minPrice,count:s.count,isLowest:s.minPrice===entry.minPrice});
        }
      }
    }
    offers.sort((a,b)=>a.price-b.price);

    if(!offers.length){
      box.innerHTML=`<div class="option-card"><div><b>${esc($("#ordItemSearch").value.trim())}</b><div class="muted">صنف غير مسعر في الفواتير السابقة</div></div><button class="btn small secondary" id="addCustomLine">إضافة بدون سعر</button></div>`;
      $("#addCustomLine").onclick=async()=>{
        const qty=Math.max(1,Number($("#ordItemQty").value)||1);
        activeOrder.lines.push({name:$("#ordItemSearch").value.trim(),unit:"أساسي",supplier:"غير محدد",price:0,qty});
        await put("orders",activeOrder);$("#ordItemSearch").value="";box.innerHTML="";drawOrderView();
      };
      return;
    }

    box.innerHTML=offers.slice(0,12).map((o,i)=>`
      <div class="option-card ${o.isLowest?"lowest":""}">
        <div>
          <b>${esc(o.name)}</b> <span class="tag">${esc(o.unit)}</span> ${o.isLowest?`<span class="tag green">أقل سعر ★</span>`:""}
          <div class="muted">المورد: <b>${esc(o.supplier)}</b> · السعر: <b class="price-good">${money(o.price)}</b> · طُلب ${o.count} مرات</div>
        </div>
        <button class="btn small" data-pick="${i}">اختيار وإضافة</button>
      </div>`).join("");

    $$("[data-pick]",box).forEach(btn=>btn.onclick=async()=>{
      const o=offers[Number(btn.dataset.pick)];
      const qty=Math.max(1,Number($("#ordItemQty").value)||1);
      const existing=activeOrder.lines.find(l=>norm(l.name)===norm(o.name)&&norm(l.unit)===norm(o.unit)&&norm(l.supplier)===norm(o.supplier));
      if(existing) existing.qty=Number(existing.qty)+qty;
      else activeOrder.lines.push({name:o.name,unit:o.unit,supplier:o.supplier,price:o.price,qty});
      await put("orders",activeOrder);
      $("#ordItemSearch").value="";$("#ordItemQty").value="1";box.innerHTML="";
      toast("تمت الإضافة للطلبية");
      drawOrderView();
    });
  };

  // Render Grouped Order Tables (Print Ready)
  const drawOrderView=()=>{
    const area=$("#orderPrintArea");
    const ordLines=activeOrder.lines||[];
    if(!ordLines.length){
      area.innerHTML=`<div class="panel empty">الطلبية فارغة. ابحث عن أي صنف أعلاه لإضافته.</div>`;
      return;
    }
    const grouped=new Map();
    ordLines.forEach((l,idx)=>{
      const sup=l.supplier||"غير محدد";
      if(!grouped.has(sup)) grouped.set(sup,[]);
      grouped.get(sup).push({...l,_idx:idx});
    });

    const totalQty=ordLines.reduce((s,l)=>s+Number(l.qty||0),0);
    const grandTotal=ordLines.reduce((s,l)=>s+(Number(l.qty||0)*Number(l.price||0)),0);

    const groupsHtml=[...grouped.entries()].map(([sup,arr])=>{
      const supTotal=arr.reduce((s,l)=>s+(Number(l.qty||0)*Number(l.price||0)),0);
      return `<div class="panel">
        <div class="page-head" style="margin-bottom:10px">
          <div><h3>المورد: ${esc(sup)} (${arr.length} أصناف)</h3></div>
          <div><b>الإجمالي: <span class="price-good">${money(supTotal)}</span></b></div>
        </div>
        ${table(["#","اسم الصنف","الوحدة","الكمية","السعر المختار","الإجمالي","حذف"],arr.map((l,i)=>`
          <tr>
            <td>${i+1}</td>
            <td><b>${esc(l.name)}</b></td>
            <td>${esc(l.unit||"-")}</td>
            <td><b>${money(l.qty)}</b></td>
            <td class="price-good">${money(l.price)}</td>
            <td><b>${money(Number(l.qty||0)*Number(l.price||0))}</b></td>
            <td class="no-print"><button class="btn small danger" data-rmline="${l._idx}">حذف</button></td>
          </tr>`).join(""))}
      </div>`;
    }).join("");

    area.innerHTML=`
      <div class="print-only-head">
        <h2>طلبية شراء أصناف — ${esc(activeOrder.number)}</h2>
        <p>صيدلية أسطول الدواء المركزية · التاريخ: ${esc(activeOrder.date)}</p>
      </div>
      ${groupsHtml}
      <div class="panel" style="background:#fafafa">
        <div class="cards" style="margin-bottom:0;grid-template-columns:repeat(3,1fr)">
          <div class="stat-card"><div class="label">عدد الأصناف</div><div class="value">${ordLines.length}</div></div>
          <div class="stat-card"><div class="label">إجمالي الكميات</div><div class="value">${money(totalQty)}</div></div>
          <div class="stat-card"><div class="label">القيمة الإجمالية</div><div class="value price-good">${money(grandTotal)}</div></div>
        </div>
      </div>`;

    $$("[data-rmline]",area).forEach(b=>b.onclick=async()=>{
      activeOrder.lines.splice(Number(b.dataset.rmline),1);
      await put("orders",activeOrder);
      drawOrderView();
    });
  };
  drawOrderView();
}

/* ==================== SUPPLIERS, HISTORY, BACKUP ==================== */
async function renderSuppliers(el){const sups=await all("suppliers");el.innerHTML=pageHead("الموردون","إدارة دليل الموردين.",`<button class="btn" id="addSupplier">＋ إضافة مورد</button>`)+table(["اسم المورد","الهاتف","العنوان","ملاحظات"],sups.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.phone||"-")}</td><td>${esc(x.address||"-")}</td><td>${esc(x.note||"-")}</td></tr>`).join(""));$("#addSupplier").onclick=()=>showModal("إضافة مورد",`<div class="grid-form">${field("اسم المورد","name",true)}${field("الهاتف","phone")}${field("العنوان","address")}<div class="field wide"><label>ملاحظات</label><input name="note"></div></div>`,async()=>{const f=formValues();if(!f.name)return toast("أدخل اسم المورد");await add("suppliers",f);await audit("إضافة مورد",f.name);closeModal();renderSuppliers(el)})}
async function renderHistory(el){const [invs,lines]=await Promise.all([all("invoices"),all("invoiceLines")]);el.innerHTML=pageHead("سجل المشتريات","سجل الفواتير والأصناف وأسعارها التاريخية.")+`<div class="panel"><h3>الفواتير</h3>${table(["رقم الفاتورة","المورد","التاريخ","عدد الأصناف","الإجمالي"],invs.slice().reverse().map(x=>`<tr><td>${esc(x.number||"-")}</td><td>${esc(x.supplierName||"-")}</td><td>${esc(x.date||"-")}</td><td>${x.lineCount}</td><td>${money(x.total)}</td></tr>`).join(""))}</div><div class="panel"><h3>تفاصيل الأصناف</h3>${table(["الصنف","المورد","الكمية","سعر الشراء","البونص","السعر الفعلي","التشغيلة","الانتهاء"],lines.slice().reverse().map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.supplierName||"-")}</td><td>${money(x.qty)} ${esc(x.unit)}</td><td>${money(x.price)}</td><td>${money(x.bonus)}</td><td class="price-good">${money(x.effectivePrice)}</td><td>${esc(x.batch||"-")}</td><td>${esc(x.expiry||"-")}</td></tr>`).join(""))}</div>`}
async function renderBackup(el){
  el.innerHTML=pageHead("النسخ الاحتياطي","تصدير بيانات النظام إلى JSON أو استعادة نسخة سابقة بعد التحقق منها.")+`<div class="panel"><h3>تصدير نسخة احتياطية</h3><p class="muted">يشمل الأصناف والموردين والفواتير وتفاصيلها والنواقص والطلبيات وسجل التدقيق.</p><button class="btn" id="exportBackup">تنزيل النسخة الاحتياطية</button></div><div class="panel"><h3>استعادة نسخة احتياطية</h3><div class="notice">الاستعادة تستبدل البيانات الحالية بالكامل. صدّر نسخة حديثة قبل المتابعة.</div><label class="file-label">اختيار ملف JSON <input type="file" id="restoreFile" accept=".json"></label><button class="btn danger" id="restoreBackup">استعادة البيانات</button></div>`;
  let restore=null;
  $("#exportBackup").onclick=async()=>{try{const data={app:"PharmacyHezam",version:1,exportedAt:new Date().toISOString(),stores:{}};for(const n of STORE_NAMES)data.stores[n]=await all(n);download(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`pharmacy-backup-${today()}.json`);toast("تم تجهيز النسخة الاحتياطية")}catch(err){console.error(err);toast("تعذر إنشاء النسخة الاحتياطية")}};
  $("#restoreFile").onchange=async e=>{try{const file=e.target.files?.[0];if(!file)throw Error();const parsed=JSON.parse(await file.text());if(parsed.version!==1||!parsed.stores||!STORE_NAMES.every(n=>Array.isArray(parsed.stores[n])))throw Error("invalid backup");for(const n of STORE_NAMES)for(const item of parsed.stores[n])if(!item||typeof item!=="object"||Array.isArray(item))throw Error("invalid record");restore=parsed;toast("تم التحقق من ملف النسخة وبنية جميع الجداول")}catch{restore=null;toast("ملف النسخة غير صالح أو غير متوافق")}};
  $("#restoreBackup").onclick=async()=>{if(!restore)return toast("اختر ملف نسخة صالحاً أولاً");if(!confirm("سيتم استبدال جميع البيانات الحالية. هل تريد المتابعة؟"))return;try{const tx=db.transaction([...STORE_NAMES],"readwrite");for(const n of STORE_NAMES){const st=tx.objectStore(n);st.clear();for(const item of restore.stores[n])st.put(item)}await transactionDone(tx);await audit("استعادة نسخة احتياطية",restore.exportedAt||"");toast("تمت استعادة البيانات بنجاح");renderBackup(el)}catch(err){console.error(err);toast("فشلت الاستعادة")}};
}
function download(blob,name){const a=document.createElement("a");const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$("#navigation").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)navigate(b.dataset.page)});
$("#mobileMenu").onclick=()=>$("#sidebar").classList.toggle("open");
(async()=>{try{db=await openDB();await navigate("dashboard")}catch(e){console.error(e);toast("تعذر تشغيل قاعدة البيانات المحلية")}})();
