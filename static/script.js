const NEWS_URL="/api/news";
const FACTCHECK_URL = "/api/factcheck";

const SECTIONS = [
    ["world", "World news"], ["politics", "Politics"], ["environment", "Environment"], ["business", "Business"], ["technology", "Technology"], ["science", "Science"], ["global-development", "Global-development"], ["sport", "Sport"], ["culture", "Culture"]

];

const $ = id => document.getElementById(id);
let stories = [];
let saved = [];
try { saved = JSON.parse(localStorage.getItem("newsdesk-saved") || "[]");} catch(e) { saved = [];}

function el(tag, props = {}, ...kids){
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k,v]) => {
        if (k === "class") n.className =v;
        else if (k ==="text") n.textContent = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
    });
    kids.forEach(k => k && n.append(k));
    return n;
}

const fmtDate = iso => new Date(iso).toLocaleDateString("en-GB",{day:"numeric",month:"short", year:"numeric"});
const friendly = err => err.name === "TypeError"
   ? "Could not reach the server. Check that the backend is running and open the app through it."
   : err.message;

async function loadStories(){
    const params = new URLSearchParams({
        q: $("q").value.trim(),
        section: $("section").value,
        hours: $("range").value,
        sort: $("sort").value
    });
    $("storiesHd").textContent = "Loading stories...";
    $("stories").replaceChildren();
    try {
        const res = await fetch(NEWS_URL + "?" + params);
        const data = await res.json().catch(()=> ({}));
        if (!res.ok) throw new Error(data.error || "The news service did not respond. Try again in a moment.");
        stories = data.results || [];
        render();
    } catch(err){
      stories = [];
      $("storiesHd").textContent = "";
      $("stories").replaceChildren(el("li", {class:"empty"}, el("h2", {text:"Stories could not load"}), el("p", {text:friendly(err)})));
    
    }
}

function render(){
    $("storiesHd").textContent = stories.length === 1 ? "1 story" : stories.length + "stories";
    const ul = $("stories");
    ul.replaceChildren();
    
    if (!stories.length){
        ul.append(el("li", {class:"empty"}, el("h2", {text: "No stories match"}),el("p", {text: "Try a broader keyword, a longer time range, or clear the filters."})));
        return;


    }
    stories.forEach(s => {
        
        const issaved = saved.some(x => x.id === s.id);
        const saveBtn = el("button", {class:"chip", type:"button", "aria-pressed":String(issaved), text:issaved ? "Saved": "Save for follow-up", onclick:() => toggleSave(s)});
        const checkBtn = el("button", {class:"chip", type:"button", text:"Check this claim", onclick:() => {
            $("claim").value = s.title; $("claim").focus();
            $("fcForm").scrollIntoView({behavior:"smooth", block:"center"});        
        }});
        const body = el("div", {}, el("h2", {}, el("a", {href:s.url, target:"_blank", rel:"noopener",text:s.title })), el("p",{class:"meta"}, el("b", {text:s.section})), el("p", {class:"meta"}, el("b", {text:s.section}), document.createTextNode(" " + (s.byline ? "by" + s.byline + ", ": "") + fmtDate(s.date))), el("p", {class:"sum", text:s.summary || ""}), el("div", {class:"acts"}, saveBtn, checkBtn, el("a", {class:"chip", href:s.url, target:"_blank", rel:"noopener", text:"Read on The Guardian", style:"text-decoration:none"})));
        const thumb  = s.thumbnail
            ? el("img", {class:"thumb", src:s.thumbnail, alt:"", loading:"lazy"})
            : el("div", {class:"thumb ph", "aria-hidden":"true", text:(s.section || "N")[0]});
           ul.append(el("li", {class:"story"}, body, thumb)); 

    });

}

function toggleSave(s){
    saved = saved.some(x => x.id === s.id)
        ? saved.filter(x => x.id !== s.id)
        : [...saved, {id:s.id, title:s.title, url:s.url}];
      try { localStorage.setItem("newsdesk-saved", JSON.stringify(saved));}
catch(e) {}
    render(); renderSaved();        
}

function renderSaved(){
    const ul = $("saved");
    ul.replaceChildren();
    if (!saved.length){
        ul.append(el("li", {}, el("span", {style:"color:var(--muted)", text:"Nothing saved yet. Use Save for follow-up on any story."})));
        return;
    }
    saved.forEach(s => ul.append(el("li", {},
            el("a",{href:s.url, target:"_blank", rel:"noopener", text:s.title}),
            el("button", {type:"button", "aria-label":"Remove" + s.title, text:"Remove", onclick:() => toggleSave(s)}))));
}

async function checkClaim(e){
    e.preventDefault();
    const claim = $("claim").value.trim();
    const box = $("verdicts");
    if (!claim){ box.replaceChildren(el("p", {class:"note err", text:"Enter a claim to check."})); return;}
    $("fcBtn").disabled = true; $("fcBtn").textContent = "Checking...";
    box.replaceChildren(el("p", {class:"note", text:"Searching fact-checkers..."}));
    try {
        const res = await fetch(FACTCHECK_URL + "?query=" + encodeURIComponent(claim));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "The fact-check service did not respond. Try again in a moment.");
        const results = data.results || [];
        box.replaceChildren();
        if (!results.length){
            box.append(el("p", {class:"note", text:"No fact-checks found for this claim. Try fewer words or a more specific statement."}));
        } else {
            results.forEach(r => box.append(el("div", {class:"verdict r-" + (r.level || "mixed")},
                el("p", {class:"rating", text:r.rating}),
                el("p", {class:"by", text:"Rated by" + r.publisher}),
                el("p", {class:"claim", text:r.claim}),
                el("a", {href:r.url, target:"_blank", rel:"noopener", text:"Read the full check"}))));
        }
        } catch(err){
            box.replaceChildren(el("p", {class:"note err", text:friendly(err)}));
        } finally {
            $("fcBtn").disabled = false; $("fcBtn").textContent = "Check claim";

        }
}


SECTIONS.forEach(([v, l]) => $("section").append(el("option", {value:v, text:l})));
$("searchForm").addEventListener("submit", e => { e.preventDefault(); loadStories(); });
["section", "range", "sort"].forEach(id => $(id).addEventListener("change", loadStories));
$("reset").addEventListener("click", () => {
    $("q").value = ""; $("section").value = ""; $("range").value = "0";
$("sort").value = "new"; loadStories();
});
$("fcForm").addEventListener("submit", checkClaim);

renderSaved();
loadStories();

