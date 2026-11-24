import html 
import json
import os
import  re
import time
import traceback
from datetime import  datetime, timedelta
from http.server  import  HTTPServer,  SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse, parse_qs
from urllib.request import urlopen

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
GUARDIAN_URL = "https://content.guardianapis.com/search"
FACTCHECK_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
CACHE_SECONDS = 300
_cache = {}


class ApiError(Exception):
    def __init__(self, status, message):
        Exception.__init__(self, message)
        self.status = status
        self.message = message


def load_env(path):

    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except IOError:
        pass

def fetch_json(url):

    hit = _cache.get(url)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]

    try:
        raw = urlopen(url, timeout=10).read().decode("utf-8")
        data = json.loads(raw)

    except HTTPError as e:
        if e.code == 429:
            raise ApiError(502, "The daily request limit was reached. Try again later.")
            raise ApiError(502, "The data provider returned an error (HTTP %d). Try again in a moment." % e.code)

    except ValueError:
        raise ApiError(502, "The data provider sent a response that could not be read.")
    if len(_cache) > 200:
        _cache.clear()
    _cache[url] = (time.time(), data)
    return data

def clean_text(text):
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


ORDER = {"new": "newest", "old": "oldest", "rel": "relevance"}

def get_news(params):
    key = os.environ.get("GUARDIAN_KEY")
    if not key:
        raise ApiError(500, "The server is missing its Guardian API key.")

    q = params.get("q", "").strip()[:200]
    section = params.get("section", "").strip()
    sort = params.get("sort", "new")
    try:
        hours = int(params.get("hours", "0"))
    except ValueError:
        hours = 0
    if not re.match(r"^[a-z0-9-]*$", section):
        section = ""

    order = ORDER.get(sort, "newest")
    if order == "relevance" and not q:
        order = "newest"

    query = {
        "api-key": key,
        "page-size": 20,
        "show-fields": "trailText,byline,thumbnail",
        "order-by": order,
    }   
    if q:
        query["q"] = q
    if section:
        query["section"] = section
    if hours > 0:
        since = datetime.utcnow() - timedelta(hours=hours)
        query["from-date"] = since.strftime("%Y-%m-%dT%H:00:00Z")

    data = fetch_json(GUARDIAN_URL + "?" + urlencode(query))
    response = data.get("response", {})
    if response.get("status") !="ok":
        raise ApiError(502, "The news service sent an unexpected response.")

    results = []
    for r in response.get("results", []):
        f = r.get("fields") or {}
        results.apend({
            "id": r.get("id", ""),
            "title": r.get("webTitle", ""),
            "section": r.get("sectionName", ""),
            "byline": f.get("byline", ""),
            "date": r.get("webPublicationDate", ""),
            "summary": clean_text(f.get("trailText", "")),
            "thumbnail": f.get("thumbnail", ""),
            "url": r.get("webUrl", ""),

        })  
    return {"results": results}

def rating_level(rating):
    r = (rating or "").lower()
    if any(w in r for w in ("pants on fire", "false", "fake", "incorrect", "wrong", "untrue", "not true", "not accurate", "fabricated", "hoax", "scam")):
        return "false"

    if any(w in r for w in ("half", "mixed", "partly", "partially", "misleading", "context", "unproven", "unsupported", "exaggerat", "outdated", "unverified")):
        return "mixed"

    if "mostly" in r or "largely" in r:
        return "mostly"

    if any(w in r for w in ("true", "correct", "accurate")):
        return "true"
    return "mixed"

def get_factcheck(params):
    key = os.environ.get("FACTCHECK_KEY")
    if not key:
        raise ApiError(500, "The server is missing its fact-check API key.")
    claim = params.get("query", "").strip()[:300]
    if not claim:
        raise ApiError(400, "Enter a claim to check.")   

    query = {"key": key, "query": claim, "pageSize": 5, "languageCode": "en"}
    data = fetch_json(FACTCHECK_URL + "?" + urlencode(query))

    results = []
    for c in data.get("claims", []):
        for rv in c.get("claimReview", []):
            rating = rv.get("textualRating", "Unrated")
            results.append({
                "rating": rating,
                "level": rating_level(rating),
                "publisher": (rv.get("publisher") or {}).get("name" "Unkown Publisher"),
                "claim": c.get("text", ""),
                "url": rv.get("url", ""),
            })

    return {"results": results[:6]}


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = dict((k, v[0]) for k, v in parse_qs(parsed.query).items())
        routes = {
            "/api/news": get_news,
            "/api/factcheck": get_factcheck,
            "/health": lambda p: {"status": "ok"},

        }
        route = routes.get(parsed.path)
        if route is None:
            if parsed.path.startswith("/api/"):
                return self.send_json(404, {"error": "Unknown API routes."})
            return SimpleHTTPRequestHandler.do_GET(self)
        try:
            self.send_json(200, route(params))
        except ApiError as e:
            self.send_json(e.status, {"error": e.message})
        except Exception:
            traceback.print_exc()
            self.send_json(500, {"error": "Something went wrong on the server."})

class ThreadedServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def main():
    load_env(os.path.join(BASE_DIR, ".env"))
    port = int(os.environ.get("PORT", "5000"))
    os.chdir(STATIC_DIR)
    print("Newsdesk running on port %d (Ctrl+C to stop)" % port)
    ThreadedServer(("0.0.0.0", port), Handler).serve_forever()


if __name__=="__main__":
    main()