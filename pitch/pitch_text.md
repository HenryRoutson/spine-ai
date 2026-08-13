

# Who am I?

I'm Henry,
I'm an AI engineer at KPMG, where I work in a team of around 12 with 5 PhDs.

I've worked on production grade financial automation with AI,
and lead the development of our team's shared library of internal code infrastructure.

# What is the problem?

It's widely publicised that large companies are starting to cut AI spend after subpar results. 

Partially, we believe this is because they jumped the gun on funding technology that needed more time to mature, 
both on the model and the software side.

Additionally, small startups are struggling to implement 
- interpretable
- accurate 
- and cost efficient 
AI engineering solutions without spending 200k a year on a single engineer.

As an example of this demand,
I was contacted on LinkedIn for contract work paying 160k in 6 months, 
with less than a single year experience.

The demand for high quality AI engineering work is extremely high, 
but companies are having to cut funding without results. 

# Who is the ICP for this problem? Who feels this problem the most?

we see it as

technical founders of 'AI-native' companies without specific AI-engineering experience.

Startup founders are at risk of losing their jobs within months without high quality AI engineering.

# Why now?

Large enterprises are cutting AI spending and so are custom AI solutions with subscription products, where they want low cost at high scale.
Additionally, Flash-class models are incredibly mature now, and running inference will be dramatically cheaper than 2 years ago.

# What is the solution we're offering them.

Our single line pitch is :

Lovable for AI engineering. 

The elevator pitch is :

We offer vibe coding for AI engineering,
where you can build production level systems,
while being non technical.
We handle the hosting, and automate the backend development with AI using deep production experience.

You can then pass these vibe coded solutions to developers who will have full control over low level implementation details.

We can run inference often at a tenth or hundredth of a cent per run by avoiding agent harness overhead, and segmenting tasks to allow for Flash models instead of requiring the frontier.

We could close to feature parity on companies worth around 100 million, in a couple of weeks.


# in a few words, how are we differentiated?


We're very opinionated about AI engineering, and this is built into our platform.

1. 
embedding RAG is uninterpretable -> impossible to debug and fix.
What's the fix?
Chain of thought - everywhere.
feed that chain of thought trace when there is a test case divergence > quick fixes, often automatic.

2. 
agents are very useful, 
but for production systems they're 
- more variable
- expensive in particular with small tasks 

By some measurements agents can be 37x as expensive as a direct chatbot response. (https://www.youtube.com/watch?v=8ji5vURIllM&t=267s)

Inference while testing our product had often been less than a single cent, because we don't have the 30 thousand tokens overhead like Claude Code.
Agents are still available, but only where required.

3. 
Claude Code is great, 
but it often creates tangled blobs of code rather than separate interpretable steps. 
Our platform creates modular blocks of code, often handled with pre-built steps, and caches these to achieve greater cost efficiency.

4. 
structured responses catch bugs early,
allow smaller models to be used,
and save you from manually prompting



# Development progress

For around 2 weeks full time development and 120k lines of code, I've got a fully chargeable stripe-integrated product given some bug fixes,
and a prototype vibe coding agent.

Our future development focus is on an agent which can guide someone non-technical to creating a highly reliable backend. 
We output data into Excel natively, and we've automated error tracing and isolation with our structured approach, a key inhibitor to raw Claude Code vibe coding.

# Who are the competitors? and How much money could this make?

We've conducted extensive competitor analysis, and used a subset of their products.
We've identified around 90 companies which are direct competitors or adjacent to our product.
The leading product with the highest annual recurring revenue is Relevance AI at 13M ARR.

From my experience in KPMG, I know that Relevance AI isn't used in production, and wouldn't be taken seriously to do that.
It's exclusively used for non-technical client demos, and requires the development team to develop the demos. 
This is despite repeated pushes to use the tool internally.

So the most valuable product in this space 
- isn't adopted by leadership 
- isn't adopted by developers

Is this lack of adoption because the product isn't needed? 
Absolutely not, I developed 50 k lines of code inside of KPMG to mimic what Relevance AI does but at scale.







Briefly.
A closer product to Spine is Dify.ai.
It's got more developer features than Relevance AI and around 450k lines of code. 
Launching around 3 years ago, it now has 3 million ARR at 180 million valuation.



# feature comparison 

A small subset of high level features to compare across products.

| Platform | Visual builder | Typed schema enforcement | Multi-language code eject | Step-level eval harness | Run observability | Creator monetization | Self-host / custom LLM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Spine** | Yes | Yes | Yes | Yes | Yes | Yes | Part |
| Dify AI | Yes | Part | — | Part | Yes | — | Yes |
| Vellum AI | Yes | Yes | Part | Yes | Yes | — | — |
| StackAI | Yes | — | — | Part | Part | — | Part |
| Windmill | Yes | Part | Part | — | Yes | — | Yes |
| Relevance AI | Yes | — | — | — | Part | — | — |
| Gumloop | Yes | — | — | — | Part | Part | — |
| BoundaryML | — | Yes | Yes | Part | Part | — | Yes |
| Flowise | Yes | — | — | — | Part | — | Yes |
| Langflow | Yes | — | — | — | Part | — | Yes |
| Wordware | Yes | Part | — | — | Part | Part | — |




# TAM, SAM, SOM

| | Consumer | Enterprise | Total |
| TAM 2026 | $5B | $20B | $25B |
| TAM 2030 | $17B | $68B | $85B |
| SAM | $0.7B | $2.0B | $2.7B |
| SOM base, m36 | $3M | $5M | $8M |
| SOM bull, m36 | $30M | $12M | $40M+ |

# Traction

For context, I was planning on pivoting, but I've come back to this idea.
Hence, I haven't put time into traction except for the last day and a half. 

Strong industry connections with NAB, KPMG, and AI-Engineering agencies, a phone call away.

Interviews with startup founders experiencing severe and urgent pain with AI engineering. 
discovered that they were not familiar with chain of thought or prompt caching, two critical engineering tools for AI engineering solutions.

I conducted user interviews with 2 enterprise developers.
They're using Cursor or Claude Code to develop solutions from scratch.
In no way is this a bad solution for them, but it means the current market has its valuations potentially without enterprise adoption.



# Pricing

Initially, free with inference markup to get maximum user feedback. 
Later, a synergistic multi-pronged approach.
- vibe coding consumer facing product - name brand driver
- enterprise development tooling and vibe coding
- enterprise consulting services 


# GTM

reach out to AI startup founders, sell vibe coding for consulting pricing.
Build a portfolio of customers, and get real product feedback. 

At the same time, pitch to larger companies with industry connections for trials. 

Our vibe coding solution for pitching to execs,
Our engineering tool solution for devs.

# What is our moat?

Claude eats our product with time, which was my original reason for pivoting.
Currently, a Claude Code user still needs to handle deployment, until Anthropic clones our product.
Until then, we will still be the lowest friction solution to engineering a backend.

Our plan is : make money first, build a moat later.
No product is truly safe from a superintelligent Claude 10, 
and adapting to market demand is the best plan. 

# Requesting

We require minimal funding or runway.

5% for $200,000 at a $4 million valuation.

# Quick technical deep dive


*show images*













TODO compare this to https://streamlit.io/playground?example=geospatial
it's really a backend deployment tool + AI node editor