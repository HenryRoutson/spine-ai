

# Who am I?

I'm Henry,
I'm an AI engineer at KPMG, where I work in a team of around 12 with 5 PhDs.

I've worked on production grade financial automation with AI,
and lead the development of our team's shared library of internal code infrastructure.

# What is the problem?

what's the problem we're trying to solve?

It's AI development for enterprise and startups.

It's widely publicised that large companies are starting to cut AI spend after subpar results. 

Partially, we believe this is because they jumped the gun on funding technology that needed more time to mature, 
both on the model and the software side.

Additionally, small startups are struggling to implement 
- interpretable
- accurate 
- and cost efficient 
AI engineering solutions without spending 200k a year on a single engineer.

The demand for high quality AI engineering output is extremely high, 
but companies are having to cut funding without seeing results. 

# Who is the ICP for this problem? Who feels this problem the most?

we see it as technical founders of 'AI-native' startups without specific AI-engineering experience.

Startup founders are at risk of losing their jobs within months without high quality AI engineering.

# Why now?

So why now? there are changes in enterprises, model capability and syngeristic products that have exploded in popularity.

firsly,
Large enterprises are cutting AI spending.
Our product is designed to reduce the single biggest expense, which is developer time.

secondly
Flash-class models are incredibly mature now, and running inference and vibe coding will be dramatically cheaper than 2 years ago.

thirdly
Vibe coding is about to automate large parts of backend work

finally
Lovable and other similar vibe coding solutions are lacking back end code required to make a working product, 
we could be the final peice of the puzzle for non technical engineers looking to complete their product without learning claude code.



# What is the solution we're offering them.

Our single line pitch is :

Lovable for backend. (with a focus on AI)

The elevator pitch is :

We offer vibe coding for AI engineering and backend code,
where you can build production level systems,
while being non technical.
We handle the hosting, and automate the backend development with AI using deep production experience.

You can then pass these vibe coded solutions to developers who will have full control over low level implementation details.

For AI engineering,
We can run inference often at a tenth or hundredth of a cent per call by avoiding agent harness overhead, which is around 30 thousand tokens, and segmenting tasks to allow for Flash models instead of requiring the frontier.


# in a few words, how are we differentiated from the competition?


We're very opinionated about AI engineering, and this is built into our platform.

firstly
embedding RAG is uninterpretable which means it's often impossible to debug the real issue and fix.
What's the fix?
Chain of thought - everywhere.
feeding chain of thought traces when there is a test case divergence results in quick fixes, often automatic without human intervention.

secondly
agents are very useful, 
but for production systems they're,
- more variable
- and expensive, in particular with small tasks 
By some measurements agents can be 37x as expensive as a direct chatbot response. (https://www.youtube.com/watch?v=8ji5vURIllM&t=267s)
Inference while testing our product had often been less than a single cent, because we don't have the 30 thousand tokens overhead like Claude Code.
Agents are still available, but only where required.

thirdly
Claude Code is great, 
but it often creates tangled blobs of code rather than separate interpretable steps. 
Our platform creates modular blocks of code, often handled with pre-built steps, and caches these to achieve greater cost efficiency.

forth
structured backends catch bugs early,
allow smaller models to be used,
and save you from manually prompting

finally
the key to unlocking fast adoption,
is a full vibe coding UI with no learning curve.
None of the competitors have adopted this UI.


# Development progress

For around 2 weeks full time development and 120k lines of code, I've got a fully chargeable stripe-integrated product given some bug fixes,
and a prototype vibe coding agent.

Our future development focus is on an agent which can guide someone non-technical to creating a highly reliable backend. 
We output data into Excel natively, and we've automated error tracing and isolation with our structured approach, a key inhibitor to raw Claude Code vibe coding.

We could close to feature parity at a glance on companies worth around 100 million, in a couple of weeks with some of the new vibe coding tools.



# Who are the competitors? and How much money could this make?

We've conducted extensive competitor analysis, and tried out a subset of their products.
We've identified around 90 companies which are either direct or adjacent competitors to our product.
The leading product we've observed is Relevance AI at 13M ARR and growing quickly.

From my experience in KPMG, I know that Relevance AI isn't used in production, despite a push from leadership.
It's exclusively used for non-technical client demos, and requires the development team to develop the demos. 
This is despite repeated pushes to use the tool internally.
We can do better.

The most valuable product in this space 
- isn't adopted by leadership 
- isn't adopted by developers

Is this lack of adoption because the product isn't needed? 
Absolutely not, I developed 50 k lines of code inside of KPMG to mimic what Relevance AI does but at scale.

# Validation

What work have i done for validation?

I've interview developers from large enterprises and small startup founders experiencing severe and urgent pain with AI engineering. 

I discovered that a small AI startup wasn't familiar with much of the AI engineering terminology required to develop a suitable solution. 

With regards to enterprises,
In CBUS and KPMG, despite PhD qualifications, teams are struggling to ship to production. Latency is often up to 6 months to ship a product.
NAB and KPMG have both only started seeing their shipping pace rise after years long investments into internal tooling. 




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

...



# Traction

for some context on traction, I was going to pivot from this idea, so we're light on traction at the moment, but that's our current concern.

I've got strong industry connections with NAB, KPMG, and AI-Engineering agencies, a phone call away which i'm planning to leverage.

# Pricing

What's our plan for pricing?

Initially, free with inference markup to get maximum user feedback. 
Later, a synergistic multi-pronged approach.
- vibe coding consumer facing product - name brand driver
- enterprise development tooling and vibe coding
- enterprise consulting services 


# GTM


What's our go to market?

reach out to AI startup founders, sell vibe coding for consulting pricing.
Build a portfolio of customers, and get real product feedback. 

At the same time, pitch to larger companies with industry connections for trials. 

Our vibe coding solution for pitching to execs,
Our engineering tool solution for devs.

# What is our moat?

what is our moat?

Claude eats our product with time, which was my original reason for pivoting.
Currently, a Claude Code user still needs to handle deployment, until Anthropic clones our product.
Until then, we will still be the lowest friction solution to engineering a backend.

Our plan is : make money first, build a moat later.
No product is truly safe from a superintelligent Claude 10, 
and adapting to market demand is the best plan. 

By the time we need to pivot, we should have a data pool from user usage.
xAI just acquired cusor for 60B, our hope is that the more accesisble version of cusor we're offering could have similar data volume.

# Requesting

What funding are we requesting.

We require minimal funding or runway.

We're requesting
5% for $200,000 at a $4 million valuation.

# Quick technical deep dive


*show images*










