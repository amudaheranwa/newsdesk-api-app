# Newsdesk

A web app for journalists that does two jobs in one place: search recent news from The Guardian, and check a claim against published fact-checks before it goes into a story.

## Contents
- [Link & Demo](#link--demo)
- [Why I Built This](#why-i-built-this)
- [What It Does](#what-it-does)
- [How It Works](#how-it-works)
- [Setup & Deployment](#setup--deployment)
- [Challenges & What I Learned](#challenges--what-i-learned)
- [Credits & APIs](#credits--apis)

---

## Link & Demo

- **Demo Video (Under 2 Minutes):** [https://youtu.be/jXNKOFJdLe8]
- **Deployable Link preview:** [https://8082-cs-e1ef9edd-9c22-4fc8-9b1c-20bc6bb590d2.cs-europe-west1-iuzs.cloudshell.dev/]

---

## Why I Built This

I work at a media house (The New Times Rwanda) as a social media content creator. A lot of newsroom work comes down to two questions: "What has already been published on this?" and "Is this claim actually true?"

Most of the time when I am about to make a video, I have to find an article and fact-check it, and doing both tasks individually takes time out of my day. That is where the idea came from: one page where a reporter can find the coverage, then check the claim, without switching tools.

---

## What It Does

Newsdesk brings news discovery and verification together into a single workspace. A reporter can search stories by keyword and narrow them down by section and time range—covering the last 24 hours, 7 days, or 30 days—and sort the results by newest, oldest, or best match. Every story links directly back to the original article on The Guardian.

When a story raises a claim that needs verification, the user can either type the claim directly into the fact-check panel or click "Check this claim" on any article. The app shows how fact-checkers have rated it (such as false, misleading, or mostly true), identifies who rated it, and provides a link to the full fact-check. Stories that need further reporting can also be saved to a follow-up list that stays in the browser between visits.

---

## How It Works

The application follows a straightforward path from the browser through a load-balanced backend to two external journalism APIs:

`Browser -> Load Balancer (Lb01) -> Web Servers (Web01 & Web02 / Flask) -> The Guardian Open Platform API & Google Fact Check Tools API`

The frontend (HTML, CSS, and JavaScript inside the `static/` folder) sends the reader's search query or claim to the Flask backend (`server.py`). The backend attaches the required API keys, calls either The Guardian or Google API, and returns cleaned-up JSON to the page. The interface then displays the results clearly, or shows a helpful message if there are no matches or if an API error occurs.

For security, the API keys live only on the server inside an environment file (`newsdesk.env` / `.env`) that is excluded from the repository by `.gitignore`. They are never exposed in frontend code or sent to the browser. In deployment, the app runs across two web servers (`Web01` and `Web02`) with a load balancer (`Lb01`) in front on port `8082`, sharing incoming requests between both servers.

---

## Setup & Deployment

To run Newsdesk locally, clone the repository and create an environment file (`newsdesk.env` or `.env`) containing your `GUARDIAN_KEY` and `FACTCHECK_KEY`. After installing dependencies from `requirements.txt`, start the Flask app with `python3 server.py` and open `http://localhost:5000`.

For the multi-server deployment across `Web01`, `Web02`, and `Lb01`, run `bash deploy/setup.sh` to configure the containers and load balancer on port `8082`. Once running, sending requests to `http://localhost:8082/health` confirms that traffic alternates cleanly between both web servers, and the interface can be accessed via port `8082`.

---

## Challenges & What I Learned

One of the main challenges in building Newsdesk was protecting API credentials while keeping the interface fast and responsive. Calling The Guardian and Google Fact Check APIs directly from the browser would have exposed the API keys to anyone inspecting the page, so I routed every external request through the Flask backend and stored the keys in an ignored environment file.

Another one of the challenges that really made working on this project difficult was the use of codeVibe and it's unreliability to give me a correct reading on my manual to AI use percentage which really slowed down my progress and almost made it difficult to finish and submit my report when it was telling a completely different story from what I was doing.

A major practical challenge during development was not having a dedicated personal computer, which meant building, testing, and deploying the entire project inside Google Cloud Shell. Working in a browser-based cloud terminal came with session timeouts and port-forwarding quirks—unlike a standard laptop where localhost:8082 opens directly in the browser, I had to configure and route traffic through Cloud Shell's Web Preview proxy (8082-cs-...cloudshell.dev) while managing multi-container networking for Web01, Web02, and Lb01.

Another challenge came from deploying the app behind a load balancer across two separate web servers. Because `Lb01` alternates requests between `Web01` and `Web02`, saving a journalist's reading list on one server's local storage would have caused saved stories to disappear whenever the next request hit the other server. Keeping the follow-up list in the browser's `localStorage` solved this cleanly so saved articles remain available regardless of which server handles the request. Finally, because The Guardian API and Google's Fact Check API return very different JSON structures, I had to normalize the responses in `server.py` so the frontend receives consistent fields and handles empty results gracefully.

---

## Credits & APIs

Newsdesk is powered by [The Guardian Open Platform API](https://open-platform.theguardian.com/) for news search and [Google Fact Check Tools API](https://developers.google.com/fact-check/tools/api) for claim verification, and was built to support fast, reliable verification workflows in the newsroom.
