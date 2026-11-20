# newsdesk-api-app

Newsdesk

A web app for journalists that does two jobs in one place: search recent news from The Guardian, and check a claim against published fact-checks before it goes into a story.

Why I built this

I work at a media house(The New times Rwanda) as a social media content creator. A lot of newsroom work comes down to two questions: "What has already been published on this?" and "Is this claim actually true?"

Most of the time when I'm about to make a video I have to find an article and fact check it, most of the time it takes time from my day to do both tasks individually.

That is where the idea came from: one page where a reporter can find the coverage, then check the claim, without switching tools.

What it does
Search stories by keyword and narrow them by section and time range (last 24 hours, 7 days or 30 days).
Sort results by newest, oldest or best match.
Check a claim by typing it in, or by clicking "Check this claim" on any story. The app shows how fact-checkers have rated it (for example false, misleading or mostly true), who rated it, and a link to the full check.
Save stories for follow-up in a list that stays in the browser between visits.
Every story links back to the original article on The Guardian.
How it works
Browser  ->  Flask backend  ->  The Guardian Open Platform API
                            ->  Google Fact Check Tools API
The page (HTML, CSS and JavaScript in the static/ folder) sends the reader's search or claim to the Flask backend.
The backend adds the API keys, calls the Guardian or Google API, and returns cleaned-up JSON to the page.
The page shows the results, with a clear message if something goes wrong, such as no matches or an API error.

The API keys live only on the server, in a .env file that is excluded from the repository by .gitignore. They are never sent to the browser.

The app is deployed on two web servers (Web01 and Web02) with a load balancer (Lb01) in front, so requests are shared between the two servers.
