It's easy to regress if you forget about a feature.
This is all of them.


Tabs :
projects 
structure 
pipeline 
testing
inference 
share
earnings
logging
cache
documents 
docs
billing 
settings

**Consumer mode** — users without a project get a slim Run view (shared links, marketplace) instead of the full builder.


# sign in out
supabase implmented sign in and out at top of screen. 

# projects 
select from your active projects, with selected highlighted
clone built in projects
delete and rename projects
a project selector is at the top of the screen and available no matter what tab you're on
Create a blank project button
project was created and give a date in the ui.

please have a last opened variable for every project and open on load the one that is latest so you don't keep opening the same project on load

please make a sepearte page for selecting the project where you don't have to checkout a specific proejct becuase it just keeps loading and switching, just select when i go into a proejct and don't have active project while in proect select mode 

# example projects

  1. a company legal evaluation, where you provide a document about legal requirements for some type of company and then a document of what that company has done to comply with regulation. what is produced is an excel file which has broken down the atomic rules and if they are followed or not. use parallel llm calls by breaking down the legal requirements into atomic rules. accept diverse inputs.

  2. Legacy SQL migration. Perform mapping of old table field names to new table field names and where data is likely to flow. include a field which gives python code for how to produce field if mapping is many to 1 or many to 1.

  3. GPS site profiling. Provided some set of coordinates, using inherint knowledge of llms, profile the similarities in the sites and what the connecting feature like 'russian nuclear bases', 'scenic waterfalls', or 'towns named jeremy'. Use parallel llm calls.

  4. Parallel llm example. Run llm calls in parallel. Simplest example where llms answer 10 trivia questions at the same time and return a list of answers.

  5. Whole book writer. Start from a book brief, LLM an initial chapter list, then batch-LLM write each chapter in parallel and join into one markdown manuscript ready to export as `.md`.



# description / documentation
text editor and optional markdown preview for a description of a project.
This is to ensure that the agent has a high level understanding of the project instantly.

# structure
create new structure
rename a structure 
delete a structure
For a structure field you can
  rename
  change type 
  change description
  delete
  make optional
  add a field
  provide a doc string style comment on the whole structure
  pick a type which is itself another model, and see errors for when a cyclic graph forms and nothing is optional in the graph
**Quote fields** — text paired with a source-document span; auto-linked after LLM steps that output them.
preview code of structures with pydantic or zod and syntax highlighting
ask an ai assistant to change the models for you



You need to have a page which doesn't edit structs but just single types. so you can click on a placeholder and add a dict or a list and then fill out what's in that list etc. allow any inline type that you would in python like list[list[int]] or dict[str, str] or new types like quote_id_t or unfilled types like set[UNSET].


each structure should have a quick AI summarise button, which is not meant to replace human descriptions, but to quickly catch bugs or inconsistencyies like "document_summary : int".


each of the fields will have a boolean for if something is deterministic

if a struct is auto generated then lock it.

for locked fields if you try and click them, there should be a clear error message telling you that this struct is locked with an explaination as to why.


allow structs to have multpole examples rather than 1. please also add negative examples, in a list. include in prompt automatically
csv won't work if examples have commas
you need to ensure that the examples actually validate as the structure you say they are. you sholdn't be able to just have random text in a json field or number field
you probably need a popup to open the list of examples in a json editor, doesn't work in a single cell. 
atomic_code/edit_given_struct/edit_given_struct.html

add a file upload location to derive a new structure from excel, an existing file. make the combined type which has each field as a sheet and each sheet should also be added with a sheet prefix


# Pipeline

A central visualisation of all steps of the pipeline with boxes for each step and a descrpition and associated icon.

steps include 

1. **Input** — any subset of input types (not just one); default document; filename filters; optional input-description check
2. **Single LLM call** — one structured response against an output schema
3. **Batch LLM** — list in → one structured call per item → typed list out (runs in parallel)
4. **Example select** — filter a candidate list via cheap per-item LLM relevance checks (`is_relevant` + reasoning); not vector RAG; optional pre-filter cap; prompt-cache region preview in builder
5. **Custom code** — TypeScript or Python with ordered fallbacks; max runtime with profiling on overrun; runs in the browser and submits results back to the server
6. **Transform** — deterministic reshape (e.g. list unwrap/wrap); optional custom reshape code
7. **Combine inputs** — merge a side input with accumulated pipeline state into one structure
8. **Chunk** — split document text into sized/overlapping chunks as a list
9. **Merge** — recursive structural merge with per-path policies (dict deep/shallow; list concat, union, intersect, dedupe, zip, replace); optional custom merge code
10. **Assert** — validate pipeline state via code or golden expectations; passthrough on success
11. **Human review** — pause run for approve/reject before continuing; passthrough on approval
12. **Webhook** — server-side HTTP POST/PUT/PATCH to external URLs; spine `{ input, state }` in, typed JSON out; secrets via env vars
13. **Output** — named snapshots of structures anywhere in the pipeline (multiple allowed)

**Auto-managed steps** (locked, inserted by the system when needed):
- **Structure parse** — when non-JSON inputs need conversion to a typed model
- **Link quotes** — when output schemas include quote fields; resolves quotes to source-document spans for traceability

Input types include 
1. PDF - add a is_use_ocr toggle if pdf is an option.
2. Word
4. Excel
5. JSON
6. Text
7. Web
8. Image - add a is_use_ocr toggle


each step has input and output types.
input is different because it accepts pdfs for example, but everything else is validated json against pydantic models / zod defined in the structures.
if the input to one step doesn't match the output of the step previously, an error is raised.

For the input step, 
there are to types of inputs 
1. JSON-native · direct parse
2. Needs LLM conversion if not Document I/O model.
You should visualise an llm step after the input step (including if there is a combine input step), to show that some inputs might need an llm step to convert into a format if they need to map to a certain structure.


all llm steps include the option to enable a first response, not in json, to allow the model to think about it's response without thinking about formatting. https://arxiv.org/pdf/2604.03616, that's based on this paper.
it should be automatically enabled on a step that fails validation and a retry is attempted.

llms default to cheap models like deepseek.

all inputs and outputs into llm models should be stored and cached.
this may be used as training data later if the company is aquired and so is important for valuation.
companies may have an option for their own deployments which will not store this data off their site.


can you add an optional prompt for the any step for a description of the output, if it doesn't fit this descirption please raise an error. ask an llm. use a super cheap model for this with 1-2 million context window.

the pipeline is linear and has no forking.
steps have access to all other previous steps in the form of a pydantic object where every step **label** is the key. each step label must be unique across the pipeline. this allows for more complex behaviours, but a simple graph.
You also do not need 'combine input' steps after the first input, as input is implicitly combined with all the data from previous steps.
custom TypeScript / lambda steps receive the spine `input` plus the full accumulated pipeline-state object keyed by label.
arrows should be drawn based on dependencies if steps use other steps and errors should be raised if certain steps are not used or isolated parts of the tree disconnect. ideally the dependencies will be automatically dervied.

ts functions are executed on client side and sent to the server for efficiency and security
python functions ...

there should be a visualisation option where the pipeline is shown in execution order, maximising parallel execution.

there is an AI sidebar to make changes to the pipeline, which has acccess to validation errors, and needs approval before making changes.

inputs have the option to only accept files which contain a certain term in their name in addition to the file type. for example, 'legal_regulations'. 
This is to ensure that pipeline accept the correct files before anythign runs.

if there is any validation errors, this should disable the run button in the inference tab.

fallback system should look something like 
fallback_list : [
    ("python") : "def ...",
    ("python") : "def ...",
    ("typescript") : "..."
  ]
or 
{
  "fallbackList": [
    { "typescript": "(input) => JSON.parse(input.body)" },
    { "language": "python", "code": "import json\nreturn json.loads(input['body'])" },
    { "language": "typescript", "code": "(input) => input" }
  ]
}



custom code should have a hash store of all the errors that code has produced, and maybe even something based on the similarity of the code which you could do with a keyword match and then git diff quite efficiently.


the pipeline should have clickable linked to the intput and output structs that are set so you don't have to manually go to the structs tab and find it 


raise error to pipeline if code doesn't compile in a code step
code should also be fully traceable. if a piece of code fails, this is stored for future reference. 

Need dynamic scehmas. If you have a task to mark homework, you're provided with a doc to text conversion of homework to text. from this you need to create an output schema of what the marking should check like question 7 should have fields a, b, c maybe, and the question descriptoins and marking criteria is inside each of those fields. you can't hardcode this for every homework sheet. Allow the option to request llm calls to output in a dynamic format and validate in same way. Maybe a format that adheres to a certain generic structure.


ensure you can't change the input type away from document in the input step in the pipeline, unless it's json. don't try to load a pdf into some random json format without an explicit call. however json to structured model is ok.


please add a warning if you add the same struct multiple times as an input or output in a pipeline 
please make the connection which doesn't work red if input doesn't connect to output
if input x and output y, please have buttons for either x->y on step n or y->x on step n + 1.

Please add a warning if you use json input type option, as ideally you should use structures instead. 


please add a generate summary button which summarises the current pipeline and points out current issues. make this a button.

add an optional input description which is evaluated by an llm if enabled to check data is ok before being passed in to avoid attributing errors to code rather than the wrong data. also holds for files being passed in and is an extra step on top of the type system. 
pleaes make an option in settings to make input descriptoins mandatory. make sure to charge these llm checks to billing, create a seperate billing graph for this at the bottom of logging under Mean cost called Description Validation cost. then add a toggle inside each step for if the description will be checked, in case it's expensive but you want to run it occasitionally


Export the whole pipeline as a self-contained bundle: TypeScript, Python, Rust, Go, and BAML, plus connector servers (HTTP and gRPC), inference UI, setup guide, env template, and project documents. Assert no secret env keys are embedded. Generated code is linted before download.

Export dialog shows per-language download buttons and a zip of the full bundle.


you should always have the ability to view the whole pipeline as code, 
and if there are no errors in the pipeline there should be none in the code for any langauge.


please segment types into JSON or not JSON.
If and only if the type subset selected is all json can you parse to a pydantic struct inside this step. You will need to handle the if case of Using an llm if the format is not json, which should be a locked step which is added automatically for the inputs which are not automatically converted.
Ensure the user doesn't have the think about, if this structure isn't json i need to run an llm to convert it and if it is i just want to load it directly. please just handle this logic and visualise it.
  PDF - not json
  Word - not json
  Excel - json
  JSON - json
  Text - not json
  Web - not json
  Image - not json


please have a dedicated button to click which goes back to document for input steps rather than having to find it. throw an error if nothing is selected as a model output

please have a dedicated button to click which goes back to document for input steps rather than having to find it. throw an error if nothing is selected as a model output 

There should be a button to copy the json of the whole pipeline, 
but also the pipeline json, all code that it exports to and lints of that code.
You should run automated tests to assert that generated code from a valid pipeline has no lint errors before prod, and in prod any lint errors in export should be recoded in the supabase database to be fixed.


please add the option for cost limits per llm step, by default this should be $1

No RAG — use **quotes** (source-linked spans) and **example select** (LLM relevance filtering) for traceability instead of vector retrieval.

Per-step **cache toggle** on LLM steps.

code steps should have a field for the max run time, where if it goes over that time, you get a profile of the time taken and the last line executing to profile things. set at a minute by default 

# Testing 

please create a testing tab, where you can describe the exact output at each step to precisely pinpoint where a pipeline goes wrong
test files with end in _testing.json and have a checkbox logo to identify them.
test files will need to be validated if they even fit the current structure of the pipeline, as the pipeline can change as the tests may need to as well.
Allow AI to write these testing files, and setup multiple tests. 
intended to run before the inference tab which is more for demoing.
Note that as much 'testing' as possible should be done in the design tab.
A simple check if the input goes into the next step is much easier than designing a full test file.
all examples should have step by step tests, 
testing output should go into logging with the testing flag
testing isn't limited to whole runs and shouldn't need to cover all the steps. you can only provide the expected value for 3/8 steps for example, and you  only check those. you can also have 10 tests for one step and non for all the others.


you should describe if certain fields are deterministic like a maths answer, or probabilistic if they're something like a summary which will almost never be the same. if they are they can be tested, otherwise not.
deterministic param is on a field level, it shouldnt be something per test. An answer_ACBD for q1 is either A,B,C or D. This doesn't change across examples, and often needs to be finer grain than just struct level.
when testing probabilistic floats, you might also want to use a range of acceptabile answers like +- 2 instead of using a whole llm to check if it's appropritate. 

for each test there is a button to run it


tests should be saved to the logging system with a test tag,
and share the same UI but with extra visualisations of where any erorrs occured. if there is a different from actual to expected, there should be a git diff view.

non deterministic tests can be evaluated by an llm.
there should be a run all tests button

please have an indicator if the test passed last time it was run which resets when you change the test or the pipeline. 
can't be UI stored, need this in supabase to persist. Don't have syncing logic to disable things to unrun, but store a reference to the pipeline and the test and match on hash so if you change and revert you will know if something will pass or fail.
i want to see for all tests on the sidebar either pass or fail.
as storing many copies of tests and pipelines can be space intensive, you can use an expires in for around 7 days until you need to re run tests. however, if there is integration with git history logic, you can store things longer.

can you please have a run history for each test which is a list of logs you can see for each test, ignoring any changes to the test or pipeline for this.

please add a view to align each step in the testing UI with the actual pipeline at the moment and show orphaned steps 
testing needs to easily adapt to the changes in the pipeline,
you don't want to have to reconfigure your tests because you're changing your pipeline. because each step is typed, it's easy to see where test data can match into each step. You just need to make this easy to visualise and reorganise.

please note that from a testing pespective, if you're checking the inputs are correct to each step, you need to make sure that you can check inputs for 'combine input' steps and also configure what files are being uploaded.

please make scrolling expected and actual something where both scroll together and things line up only if there is the same number of lines / items. otherwise you might want to do more of a git diff to see the difference.
when there are the same number of lines, you can use a red backround for each line which isn't the same, which is behind the highlighting showing the type of check between deterinistic, tollerance and llm.

git diffs should be coloured based on + being green and red being -.
please add // not "{actual}" commens to the lines of json which are diferent. with actual replaced so that copying the text easily shows the difference when there is a 1 to 1 number of lines

please add pass fail indicators to the test selector menu so you can see which are passing or failing on the last run.

there should be a group by on the fields where you can see the mapping of what has been mapped to what with autmoatically generated confusion matricies.

in addition to the very fast per field comparisons, there should also be a larger comparison between the entirety of the json actual and expected, where an llm can give a high level overview of where there are differences.

ensure that the order of keys inside each object does not cause issues with comparisons with git diff or on a line level.

in addition to expected outputs, there should also be expected errors. you should be able to catch any type of error and be specfic. For example you should have a test to pass in the wrong homework assignment, and you should fail on validation, as the homework marking schema should validate the homework it needs to make. so nothing in the pipeline should run besides the input and it should catch this error. avoid catch all test where you say this whole test will fail, as that isn't specific and could have different failures than expected.

please ensure that when editing tests, that you're editing in a UI generated from the pydantic model and not loose json, to ensure valid json data and to make things easier for non or semi technical users.

# inference

All inputs are shown with the option to select documents.
documents are filtered based on if they adhere to the restrictions of the input model like file type or json structure. 
So you can either say, i only want pdfs or i only want json which is of this structure. 
files are already uploaded into documents, and you can select from these, with filtering based on name and extension completed.
**JSON structure inputs** — when an input slot is JSON with a typed structureOut (not Document), choose one mode: From file (store pick), Branch off (copy values into a form; source file untouched), or Create empty (schema defaults). Apply writes a new file and assigns it — never looks like in-place editing of the selected store file.
there is a run button,
when you click it a live server log appears. when the run is completed there is a button directing users to the logging tab. server logs displayed should be broken down by step in the pipeline.
there is a text field to put a description of why you are doing this run which you can edit in logging and saerch for later to organiase your runs.
if you do a run that has already been completed the same setup, there is a button that appears to go to the log and not to run.
**Run fingerprinting** — identical pipeline + inputs link to the prior run instead of re-executing.
documents are selected from the documents tab to avoid repeat uplaods, latency in upload, and work in converting to text.

**Input compatibility** — after paired uploads, compare extracted keys (JSON paths, regex, question-id sets) and show MATCH / MISMATCH / MISSING per variable before the run starts.

if you do not have enough funds in billing, a button to direct you to the billing tab will appear.

after inference is finished or if it's cached, the final output should show up. With a json, excel style viewer, or even custom visualisations like video, plots.

when using an agent, it will always write descriptions of it's input to ensure correctness.

Users should be able to see their previous chats with the spine agent. 
they should be date sorted with month seperations


you need to mininimise everything except the outputs marked as output steps when the inference run finishes. You should show all intermediate logs and outputs in the step trace, but this should be minimised as soon as the run finishes.



there should be example input and expected output files which are used to test the pipeline, 
this can be a demo for the inference. assert actual output equals expected


inference contains a list of possible runs which have been pre selected, not just a single default one. these possible runs are named for example for a homework grader you could do a 1st grade example and a university grade example where the university includes latex formatting as a more advnaced test. you can also select from the tests in the inference tab.

The inference tab should be able to save multiple named setups like for the homework example '10th grade' and 'pre school' with specific input files associated. there should not be a single default setup to the inference tab. use the same backend logic that is used to save the input setup in the testing tab.



show a preview of the code running in the inference view ideally line by line to show what might be getting stuck. if you can have a profile in the logging output to profile line by line what takes the most time that's really helpful
please add syntax highlighting and a small indicator of which language please for the inference code preview



# Share 
you should be able to share links and APIs, see what shared instances currently exist.
links should have the inference UI to the current pipeline.
you should be able to determine the pricing of these APIs,
and make money off of this into a seperate account than your credits.

you need to able to put in a billing multiple, which is how much the llm costs are, and an option for a flat fee for each call.

when you share a link with someone, they get a shared with me view, which lists off 

when sharing there should be selection options for who is paying, 
and you should be able to clearly see a diagram of 
sender -> reciever
with the spend icon on either side
$ sender $ -> reciever
OR
sender -> $ reciever $

if 
$ sender $ -> reciever
is set so that you pay as the creator of the pipeline.
you can have either
You pay (sign in required)
You pay (no sign in required)

the final option is
Reciever pays (sign in required)
which requires sign in so they can setup billing.

Some links are liabilities and some are assets,
some shared pipelines make you money and some cost you depending on what you're using the app for.

you should be able to edit the credit limit for liabilities after creating the link.
you should be able to monitor all the logs and calls that are being made for APIs and links.

**Deployment activity** — filterable feed of who ran shared links/APIs, what they uploaded, and spend.


There should be share options to 

  Share the code - open source or just send to specific people 
  Share the link - people are able to run inference on a UI
  Share the API - people are able to run inference on an API 

  The link and API can have upmarked billing so you can make money on this.
  You can also put the link or API on a market place where ppl can search to find this, rather than you sending the link to someone directly.
  for the link and API there should be an option to disable or enable if you can view the data that people are uploading or if it's hidden to you.

  sharing the code should have an ownership icon clearly transition to reciever, and for the link and API the ownership icon should stay with the sender.
  Where @ is ownership ;
  FOR CODE
  sender -> @ reciever @
  FOR LINK AND API
  @ sender @ -> reciever

there should be another page for looking at runs, should include data about how is signed in and the files they uploaded and the pipeline run.


live deployment buttons should have a toggle power button for temp disable or a pipeline and also a trash button

note that billing information shouldn't be lost when a deployment is deleted.

please add the ability to put spending limits on shared links
you should also be able to host scalable api in a few clicks and monitors the current live links and apis usage, and take them down.
you should also be able to host scalable api in a few clicks and monitors the current live links and apis usage, and take them down.and you should also be able to host scalable api in a few clicks and monitors the current live links and apis usage, and take them down.


you should be able to share the pipeline with all the details of the pipeline itself, so someone can copy it like with the examples and edit it. This won't affect your copy of it.

please add a share to marketplace button in the share tab, where you can put on the marketplace with a price or for free. There should be a marketplace where you can search for pipelines.



# Agent 

The agent tab is connected with MCP and openrouter to frontier models. 
need to add chips for pastes and selecting a part of the UI. have a cursor style UI selector to reference some part of the UI. 
ensure you use an existing library if possible.

you should be able to see chats of people in your team or working on your project.
pastes should create a chip not raw text
you should be able to select parts of the UI with a highligers for llm context
you should be able to highlight parts of the agent chat and it be added as context without copy paste. 
you should have files as context or any part of the UI with @...



# logging
The logging tab contains all the history. each log is either red or green depending on if it passed or failed.
you can search for runs, based on descriptions provided and editable when selecting the run.
logging for each run contains each steps input and output syntax highlghted, with the model linked that the json is formatted in. 
each input has a link back to the original document.
there are graphs for llm calls of the distribution of the number of characters for each input prompt and output response, and a graph of the response latency. 

Any source docments which are used for extraction of quotes, are highlighted in a color to seperate it. there is also a link back to that doucment and any quotes which are extracted can be clicked on to see the highlighted region of the text the quote is from with the ability to scroll. although the prompt or response might contain json that isn't noted, there should be an automatic json extractor which should sepearte json and add syntax highlighting.
Quotes are validated in a method that is not brute force and doesn't look through the whole dictionary, but instead uses the structs to know where quotes to validate are located.

**Example-select verdicts** — per-candidate kept/excluded audit with reasoning, browsable in the step trace.

**Diagnosis agents** — auto-spawn on failed runs; launch manually from logging to debug isolated errors. 

each step should be annoted with cost and latency

at the end there should be graphs of cost and latency across all steps to see which steps contribute the most.

there is a copy of the pipeline at the time the run was completed which will not change if the pipeline is edited. it includes everythign to see all details of this pipeline.

json can be viewed in excel popups for non techincal people. there is also a view of the json with collapsible sections.


when displaying prompts, all sub components are highlighted and profiled on their contribution to context length. JSON is syntax highlighted. Files link back to the documents tab and are highlighted in an outline. 

prompting should be stored in json for it's different components and then a static flatten function should be used to convert to the actual prompt. for example, don't store 1000 prompts with the denormalised text from a document as this is inefficient. only denormalise when sending to prompt.

please include the server logs in addition to input and output at each step with an option to hide them as default set to true in settings.
please make sure you attribute server logs to different steps in the pipeline, not just putting it in one blob


There should be a single button to click to copy the whole log of a run.



visualise prompt failures in a grid which is n_prompts x (max_retries + 1) where 1 is the first prompt without a retry.
Ensure all data from the run is included, including failures, and the whole log including the pipeline can be easily copied with a button.

ensure there is a setting to change what is displayed for each step between excel or json or other.

## Langfuse export (secondary telemetry)

Spine Logging remains the canonical in-app trace (step I/O, schema failures, example-select verdicts, testing verdicts, quote links, billing). Langfuse is an **optional secondary export** for teams that already use [Langfuse](https://langfuse.com/) for cross-app observability, dashboards, and production debugging.

**Design principles**

- **Opt-in per project** — `Project.langfuseExport` toggle in Library → Settings → Langfuse export. Off by default.
- **Server credentials only** — `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and optional `LANGFUSE_BASE_URL` (self-host) live in deployment env, never in the browser or exported pipeline zip.
- **Never blocks runs** — export is async/fire-and-forget; Langfuse SDK errors are swallowed so pipeline execution and Spine persistence are unaffected.
- **Deterministic trace id** — Langfuse `traceId` is derived from Spine `runId` via `createTraceId(runId)` so resumed runs and external scoring can correlate.
- **Logging deep link** — successful exports set `PipelineRun.langfuseTraceId` and `langfuseTraceUrl`; Logging shows “Open in Langfuse” when present.

**Observation mapping**

| Spine | Langfuse |
|-------|----------|
| `PipelineRun` | root `chain` observation |
| `RunStep` | child `span` (label, kind, status, cost, latency, verdicts in metadata) |
| each `LlmCallRecord` | child `generation` (model, char usage, latency, retry round) |
| description-check LLM calls | `generation` children prefixed `input-desc:` |

Prompt/output text is truncated (~24k chars) before export. Full prompts remain in Spine only.

**What Langfuse does not replace**

- Step-level Testing tab assertions and deterministic diffs
- Pipeline builder, structures, cache, billing, marketplace, code export
- Prompt versioning / A/B (use Langfuse prompt management separately if needed)

Exported pipelines (`connector_server.ts`, Python runners) do not auto-include Langfuse — add the Langfuse JS/Python SDK in your deployment if you want traces outside the Spine app host.

# documents

the documents tab contains all documents and their size with the ability to view them. you can also view pdf documents markdown in raw text or as formatted or as the original pdf and the same for word and other more complex documents. 
csv, excel, json can all be viewed as json, excel or in original text.
**Edit (immutable)** — JSON / tabular files can be edited in a schema-guided form (matched structure when available). The source file is never overwritten; saving requires a new file name and creates a new content-hash row.
flag and block uploads if they contain 'confidential' until you click approve

uploading a new document will check if it matches any of the existing structs and display this. you have the option to add any new structures in the document.

when viewing a pdf or image you need to options to see 
1. raw markdown text derived from pdf or image
2. formatted markdown derived from pdf or image
3. pdf or image
4. OCR labelled with bounding boxes like deepseek OCR can.

an option for csvs and also for files like excel, csv or json to automatically derive their excel structures . you should be able to go into the doucments tab and click any of the derived pydantic zod models to add to strcutres, then those structures should link back to the original document with a clickable link to show where they came from

on any tab if you are viewing some json, in the unified viewer where you can switch between json, excel and a tree structure, you have a download button

for any json structure or excel csv, if you load a file into the system, it auto finds which structs match and also derives any parts of the structure that do no match. like say you had an existing struct Tree[Node] but you input CyclicGraph[Node]. the system would match Node as the same but add the new Cyclic graph struct immedialy after uploading. this would also be done for existing files already uploaded

by default documents are tied to the project they're uploaded to. however they can be selected in a list what projects they're available in.

# Cache

browse cached step inputs and outputs across runs; search entries; inspect I/O with the same JSON viewers used in logging.

# Docs

project markdown documentation (rules and context for assistants); auto-derived mermaid pipeline graph rendered in preview.

# Billing 
current credit.
brekadown of spend between different models sorted by most spend. 
the ability to top up or subscribe to add tokens and a refresh button.
cache savings.
graph of dates and spending to see when spending decreases or increasesm, including total and model breakdown.

# Earnings

creator balance from shared links and hosted APIs; withdraw earnings to account billing credit.

# Settings
select which type of json syntax highlighting 
  App
  Pipeline / log output — green strings, blue keys, orange numbers

  Editor
  Classic code editor — peach strings, cyan keys

**Langfuse export** (per project, Library → Settings): toggle `Export runs to Langfuse`. Requires server env `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`. Optional `LANGFUSE_BASE_URL` for self-hosted Langfuse. See § Langfuse export under Logging.

select default json reader 
JSON reader
Default human view when opening JSON in the document viewer.

  Tree
  Indented outline — expand fields in place

  Table
  Spreadsheet-style rows for list-shaped data

  JSON
  Compact syntax view with foldable blocks





# other features
backend supabase should contain profit per user as a virtual table or concrete table. main expense is llm calls, ensure no user is arbitraging some mispriced llm calls. block account if value goes below -10$. ensure safegard.
when things are deleted, please improve the animation of them being deleted. i would prefer a deletion loading button and then when database updates it should fade out or collapse


there should be checks for duplicate requests, trying not to waste inference. toggle to allow or disallow, and if allowed, the duplicates are collected and then denomalise to avoid extra billing. This should be visualised how many duplicate requests have been caught


please disable pipeline editing until you fix bugs in your types and then if pipeline is disabled inference and testing are disabled
if a tab is disabled it turns red and so it should be a waterfall or if you fix billing you can fix the pipeline and then inference will pop up.

please make a shared component which is the run with stop button which should have a play icon, which when clicked shows a loading animation and a stop button next to it. ensure you handle stop logic elegantly and with shared logic.

**Teams** — shared projects, invites, membership; team owner billing; read-only team viewing.

you can resize different parts of the UI with ResizableSplit.

**A/B strategy benchmarking** — compare execution strategies (e.g. single LLM vs agent) with an LLM judge.

**Project assistant** — streaming AI dock for whole-project proposals (structures, pipeline, docs) with approval before apply.

**Prompt cache preview** — visualise cached vs per-run vs per-candidate prompt regions for LLM and example-select steps.

please add the option to allow for custom llm apis, and make this modular so that whatever the default one is like openrouter is just one of these wrapped APIs. Ensure you support features like batched responses so you can utilise that if it's availble. I'm adding this because if we're doing custom deployments into companies like KPMG, which i've worked at, we're going to need to use their internall LLM. These internal LLMs often have custom logic for calling them. You will likely need to persist a client to avoid recreating it, and try to make it easy to select which model to select in a way that is generic across custom interal APIs. this will likely just be a generic enum for model to a variable that controls this in the custom API. You will need to seperate provider and llm model, as they're seperate concepts. Ensure you export this logic into the exported code, including exporting openrouter as the default and as an option in all exports. I should be able to view the code for openrouter as an example, with syntax highlighting, and for all the different supported langauges. I should then have an option to add a provider, with code and asserts around this code that there is one function with a certain type signature maybe. I should be able to select either openrouter:gpt-5-mini or custom_provider:gpt-5-mini.
You should just have a page with a list of providers and openrouter should be a locked example. Ensure you treat the block like custom code, were you can see all the error historically that have occured in the hash exact same code (ignoring whitespace).




Thinking of errors when running the homework assessment pipeline,
although i can filter down file names to contains certain things like 
marking criteria might always contain "marking guide" in their name,
there is nothing stopping me from passing in a  "marking guide"  and a "homework sheet" which do not match. You need to have the option to only upload files after another input step when you can further filter down what files fit a format. You could do this both with pydantic format, where you check if the marking schema matches with the homework schema, but with extra marking fields. You could also do it with names where you parse the name into different values and check if those values equal. like marking_guide_SPLIT_grade10.txt and homework_SPLIT_james_miller_SPLIT_grade10.txt. However, this is janky and could lead to very long names, although names still do need to be unique. There is probably some approach with metadata or some derived data. How do i approach this? How do i error early rather than waiting for an error later? You shouldn't be blocking one file upload before another, but checking that they're compatible after both are uploaded. You should be clearly displaying the variables that are conflicting in the UI. rather than a generic 'these are not compatible', you should see something like 'MATCH assignment names, MISMATCH assignment questions, MISMATCH assignment year'. please ensure you're using dynamic pydantic schemas to be able to parse not just variables, but also how structures might change. i'm not sure how this is going to be put in the pipeline. this is a different type of error than assert, and it should come back to the user differently.

There should be a derived graph of the structure of the pipeline which is a mermaid file which should be rendered in the documentation, it should be derived from the pipeline. 

# history and merging changes 

Copy this - using git :
An integrated revision and branching system for colaboration, changes merging, and history
"""
For true 3D software with built-in version control featuring Git-like branching and commit changes, your primary options are cloud-native platforms like Onshape or multi-user ecosystems like Autodesk Fusion.
"""



# landing page

be able to put a prompt in on the landing page website and it run. obv put rate limits and use cheap model, please put into the supabase set up as billed to landing page, and have a landing page budget and record the list of calls. need a more interactive and engaging live demo than a bunch of random tabs

To get a clear idea of the app please have
  1. A text box with an enter button for a task you would like to automate which when pressed builds a full pipline and runs it with a clear trace in full expanded html outside of the view of the full app preview which isn't in the iframe. You need to run the pipeline with examples files right after the agent is done.
  2. A preview of the whole app with no run buttons working.


have a live preview on the landing page 
have a try now button which links to sign in 

have a button to book a demo in calendar using https://cal.com/

the landing page should stream tokens from the llm to make it intereseting and keep a recording with https://rrweb.com/.

Pipeline run trace in landing page should look exactly like logging in the app  and it shouldn't be a scroller inside the scroll of the landing page, but just add to the length of the landing page.
Ensure you also add the pipeline view to the length of the landing page. the output from the llm prompt in the landing page should be above the live preview. 

# dashboard 

please upgrade the dashbaord to show full timelines of people using the app including all the buttons they click, things they type and what errors are shown. please also include a visualisation of all billing and a step by step visualisation of money flow to ensure i don't lose track of it.
Include all calls to the llm, created and deleted steps, step modifications, log views, etc in this full timeline.

I need to see accounts entering money into their account, the provided starting ammount in an account, calls to llm and other expenses and what that would cost. this should create a graph over time of expenses vs money made. i should clearly be able to see if someone has started abusing the free starting amount of money and if i'm in the green or red.

I should be able to see any errors the users get.
ensure this is in the privacy policy and is legal.
this is for early users so i can see errors and issues they run into.

please ensure you model the potenial loss money as if everyone instantly used all of their free credits i might suddenly go into the red, even if it looked like previously i was in the green. you need to model for if i'm actually charging the straight llm rate, please record the % cut i'm taking on top of llm calls for each llm call to easily keep track of this. easiest way is to have a have a % markup that is dated with a range of applies from datetime so i don't have to record every single llm call, but just each time i change the markup. ensure you create a virtual table with this denormalised.
But yes, have a buffer zone for money i may or may not have to pay with the free credit.

please add replay https://rrweb.com/ for all users.
You should be able to sort replays by the number of clicks, and by which component was clicked on during that even. You should be able to filter based on what page the user visits, or if they're on the landing page or app.
You should be able to filter with a searchable users list.

The goal of the dashboard is to 
- get a clear overview of current errors and if the platform is operating reliabily
- if there are errors, they need to be logged in as much detail as possible and tied to a rrweb recording to see how it occured.
- there needs to be a graph of errors over time, potentially with different production changes indicated
- there needs to be a list of sign up members, where you can click on a single person and see their usage and retention. I need to be able to see all their AI prompts, projects and files to to see what they're building and where they might be having issues.
- tracking of money, in the liability of free credits, the markup for llm calls, the total ammount paid for credits, usage out,
- landing page tracking, including emails from the landing page and the demos which are built from the landing page agent and the recording of that with rrweb.
- marketplace tracking, API hosting tracking, sharing tracking
- heatmaps for where people spend their time in the UI for each button to light up based on it's clicks
- database size mangagement, the number of rows per table , table size in gb, 
- user feedback
- be minimal in it's code, as i don't want to be spending my time building a dashboard and would prefer to outsource that
- there should be a graph for overall activity, of how much people are using the landing page or app per day.


# Supported languages
- typescript 
- python 
- rust
- BAML : https://github.com/boundaryml/baml
- Go
- swift
- Kotlin



# merge strategies (recursive structural merger)

Per-path `MergePolicy` with `*` / `**` globs. Dict `deep` recurses; keyed list strategies
(union / intersect / concat_dedupe) and `zip` recursively merge matching elements so nested
policies apply at every layer (e.g. `dict[str, list[dict[…]]]`).

```ts
export enum MergeListStrategy {
  Concat = "concat",
  ConcatDedupe = "concat_dedupe",
  ConcatAssertNoDuplicates = "concat_assert_no_duplicates",
  Union = "union",           // by itemKey — deep-merge matches
  UnionAssert = "union_assert",
  Intersect = "intersect",   // by itemKey — deep-merge matches
  IntersectAssert = "intersect_assert",
  Replace = "replace",
  ReplaceAssert = "replace_assert",
  Prepend = "prepend",
  PrependAssert = "prepend_assert",
  Zip = "zip",               // deep-merge by index
}
```




# graduated complexity
need to start off the UI with a 
- builder developer section
- builder section (for non technical)
- consumer (for ppl not developing)
Starting a project, you start with a single prompt, and then give feedback on what was built to ensure that you're improving the agent's single prompt ability.


---

# Codebase UI hierarchy (`combined_full_stack/`)

This section maps how pages nest inside each other, from the **consumer** (run-only) view through the **pipeline creator** (builder) view. File paths are relative to `combined_full_stack/`.

References:
- [shadcn/ui components](https://ui.shadcn.com/docs/components)
- Chat-specific kits: see `chadcn_components.md` (shadcn-chat, Prompt Kit, assistant-ui, etc.)

## Top-level routes

| Route | Component | Mode | Purpose |
|-------|-----------|------|---------|
| `/` | `app/page.tsx` → `AppShellLayout` | `workspace` or **consumer** | Main app shell — builder if user has projects, consumer if not |
| `/projects` | `app/projects/page.tsx` → `ProjectPickerPage` | `picker` | Project gallery — no active project loaded |
| `/run/[id]` | `app/run/[id]/page.tsx` → `SharedRunViewer` | standalone | Public/shared link runner (no sidebar) |
| `/demo` | `app/demo/page.tsx` → `AppShellLayout` (`embed`) | `demo` | Embedded preview of builder tabs |
| `/login` | `app/login/page.tsx` | — | Sign in / sign up |
| `/privacy`, `/terms`, `/cookies`, `/accessibility` | legal pages | — | Static legal content |

## Shell architecture

All in-app navigation (except `/run/[id]` and `/login`) flows through:

```
RootLayout (app/layout.tsx)
└── StoreProvider (mode: workspace | picker | demo)
    └── AppShellProvider
        └── AppShellLayout
            ├── ConsumerShellLayout   ← no builder store (consumer)
            └── BuilderShellLayout    ← active project loaded
```

`AppShellLayout` picks consumer vs builder based on whether `useOptionalStore()` returns a builder context (`lib/store.tsx`).

---

## Navigation model — current implementation

### L0 — Primary header nav (`AppChromeHeader` + `AppPrimaryNav`)

| Section | Builder mode | Consumer mode |
|---------|--------------|---------------|
| **Run** | — | Shared links, marketplace, active shared run |
| **Build** | Workspace with active project | Navigate to project picker / builder |
| **Billing** | Account billing (hides workspace tabs) | Account billing |
| **Settings** | Account settings (hides workspace tabs) | Account settings |

Consumer and builder share the same four primary sections. **Build** shows `ProjectSelector` in the header when a project is active.

### L1 — Workspace tabs (`AppWindowNav`)

Horizontal numbered tabs under the header (replaces the old vertical `AppSidebar`). Tabs show validity state — blocked tabs turn destructive and disable click.

**Builder workspace tabs (12):** Structures (01), Pipeline (02), Testing (03), Inference (04), Share (05), Earnings (06), Logging (07), Cache (08), Documents (09), Docs (10), project Billing (11), project Settings (12).

Account **Billing** / **Settings** (L0) are separate from project **Billing** / **Settings** (tabs 11–12).

**Consumer workspace:** only **Run** (`share`) — Billing and Settings are reached via L0.

`BUILDER_AREAS` / `BUILD_STEPS` in `lib/app-nav-config.ts` define logical groupings; `BuildWorkflowStepper` exists but is not wired — grouping is visual (numbered hints) only for now.

### L2 — Page-local navigation

Entity lists (struct list, run list, test list, inference setups) and Share section pills remain inside each tab. Still the main remaining nav collision vs L1.

### Remaining refactor targets

- Collapse 12 flat workspace tabs into area sub-nav (Build stepper + Deploy / Observe / Library pills)
- Restyle L2 entity lists as muted entity rails (not nav clones)
- Pipeline inspector → collapsible right drawer
- Agent dock → sheet/drawer instead of `ResizableSplit` column

### What still feels wrong (L2+)

The app stacks **up to four navigation layers**, many using the same visual pattern (vertical list, `bg-secondary` selected row, mono labels, icon + text). Page-local lists read as a second “main menu” beside the real one.

```
┌─────────────┬──────────────────┬─────────────────────┬──────────────┐
│ L0 Primary  │ L1 Workspace     │ L2 Page list        │ L3/L4        │
│ Run|Build|… │ AppWindowNav     │ (looks like L1!)    │ Inspector /  │
│             │ 12 numbered tabs │ struct/run/test list│ Agent dock   │
└─────────────┴──────────────────┴─────────────────────┴──────────────┘
```

| Layer | What it is | Where | Problem |
|-------|------------|-------|---------|
| **L0** | Mode + account | `AppPrimaryNav` in header | Done — Run \| Build \| Billing \| Settings |
| **L1** | Workspace tabs | `AppWindowNav` (horizontal) | **12 flat peers** — logical areas exist in config but not in UI yet |
| **L2** | Page entity list | Left `ResizableSplit` inside tab | **Visually clones L1** — struct list, run list, test list, inference setups |
| **L2b** | Page sections | Horizontal pills under `WindowHeader` | Share Publish/Shared/Marketplace/Activity competes with workspace tabs |
| **L3** | Primary work area | Canvas / editor / run UI | Correct — should dominate visually |
| **L4** | Detail / tools | Right inspector, agent dock, doc viewer | Pipeline inspector + agent dock feel like another sidebar |

Concrete collisions:

1. **Structure** — workspace tab + left struct/type list = two nav rows, same styling.
2. **Pipeline** — workspace tab + right **Inspector** = user must infer inspector is step config.
3. **Logging** — workspace tab + left run list + inner pipeline canvas split = three columns of lists.
4. **Account settings** — L0 Settings hides workspace nav; project Settings (tab 12) is separate.
5. **Share** — workspace tab + horizontal section tabs + publish sub-tabs = nav inside nav.
6. **Agent dock** — `ProjectAssistantDockLayout` trailing pane uses same full-height column pattern as page sidebars.

### Target patterns (not yet fully applied)

**Must not use `Sidebar` / `SidebarMenuButton`.** Use a distinct pattern:

| Pattern | Use for | Visual treatment |
|---------|---------|------------------|
| **Entity rail** | Struct list, run list, test file list, setup list | Narrow (~200px), `bg-muted/30`, section title “Structs in project”, no icons matching app nav |
| **Section tabs** | Share publish modes, Docs edit/preview | shadcn **Tabs** under page title, full width |
| **Inspector drawer** | Pipeline step fields, logging step IO | Right panel, labeled “Step inspector”, collapsible; default closed on small screens |
| **Stepper** | Build workflow 01→04 | Horizontal stepper in Build header; clicking jumps sub-view without changing L1 |

Map current L2 → target:

| Current | Target pattern |
|---------|----------------|
| Structure struct/type list | Entity rail (left, muted) |
| Pipeline inspector | Inspector drawer (right, labeled) |
| Logging run picker | Entity rail |
| Testing test file list | Entity rail |
| Inference setup list | Entity rail |
| Settings `SETTINGS_SECTIONS` | Section tabs or anchor list inside **Account** page — hide app sidebar on Account OR replace L1 content entirely |
| Share horizontal pills | Section tabs (only nav on that page) |

#### L3 — Primary canvas (hero)

Always the largest pane. This is the only region that should feel “main”:

- Structure field grid / type editor
- Pipeline canvas (vertical step chain)
- Test editor body
- Inference run panel
- Logging run detail (IO, charts)
- Share publish forms

#### L4 — Overlays & docks (ephemeral)

Not navigation. Slide over or dock without looking like L1/L2:

| Surface | Target |
|---------|--------|
| Agent | Bottom sheet or right **Sheet** / drawer, not `ResizableSplit` column |
| Doc viewer | Modal / full-screen **Dialog** or drawer |
| Diagnosis hub | **Popover** or compact panel from header |
| Running jobs | Header dropdown only |

### Target layout (builder — Build area)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header: logo · project selector · running jobs · agent · settings · feedback│
├──────────────────────────────────────────────────────────────────────────┤
│ L1:  [ Build ]  [ Deploy ]  [ Observe ]  [ Library ]  [ Account ]         │
├──────────────────────────────────────────────────────────────────────────┤
│ L2 (Build only):  01 Structure ── 02 Pipeline ── 03 Testing ── 04 Inference │  ← stepper
├────────────┬─────────────────────────────────────────────┬─────────────────┤
│ Entity     │ L3 Canvas / editor                          │ Inspector       │
│ rail       │                                             │ (Pipeline only, │
│ (optional) │                                             │  collapsible)   │
│ ~200px     │                                             │                 │
│ muted bg   │                                             │                 │
└────────────┴─────────────────────────────────────────────┴─────────────────┘
```

When **L1 ≠ Build**, drop the stepper and entity rail unless that area needs a list (e.g. Observe → run list rail is OK).

### Target layout (consumer)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Header: logo · "run shared pipelines" · settings · feedback               │
├──────────────────────────────────────────────────────────────────────────┤
│ L1:  [ Run ]  [ Account ]                                                │
├──────────────────────────────────────────────────────────────────────────┤
│ L2 (Run):  [ Shared with me ]  [ Marketplace ]     ← Tabs, not sidebar   │
├──────────────────────────────────────────────────────────────────────────┤
│ L3: SharedWithMePanel / MarketplaceBrowsePanel / SharedRunPanel (full)   │
└──────────────────────────────────────────────────────────────────────────┘
```

No left app sidebar in consumer mode — L1 is top tabs only.

### Refactor checklist (remaining)

| Step | Action | Status |
|------|--------|--------|
| 1 | `APP_AREAS`, `BUILD_STEPS` in nav config | Done |
| 2 | L0 primary nav (`AppPrimaryNav`) | Done |
| 3 | Replace `AppSidebar` with `AppWindowNav` | Done (12 flat tabs; area grouping not wired) |
| 4 | Wire `BuildWorkflowStepper` for Build-only sub-nav | Not wired |
| 5 | Restyle page entity lists as entity rails | Open |
| 6 | Pipeline inspector → collapsible drawer | Open |
| 7 | Agent dock → Sheet/drawer | Open |
| 8 | Persist `activeWindow` in URL | Open |

`AppSidebar` remains in repo but is unused.

### State model (for refactor)

```ts
// Target — separate "area" from "view" and "selection"
type AppArea = "build" | "deploy" | "observe" | "library" | "account"
type BuildStep = "structure" | "pipeline" | "testing" | "inference"
type AppShellState = {
  area: AppArea
  buildStep?: BuildStep        // only when area === "build"
  view?: AppWindowId           // deploy/observe/library/account detail
  selection?: string           // entity id: structId, runId, testDocId, linkId
}
```

Today everything is flattened into `activeWindow: AppWindowId` (`lib/app-shell.tsx`), which encourages treating Logging and Structure as the same class of navigation.

### Graduated complexity alignment

From § graduated complexity — three audiences should map cleanly to L0/L1:

| Audience | L0 mode | L1 default | Build stepper |
|----------|---------|------------|---------------|
| Consumer | Run | Run → Shared with me | hidden |
| Builder (non-technical) | Build workspace | Build → Inference (run first) | collapsed to “Run pipeline” + “Edit pipeline” |
| Builder (developer) | Build workspace | Build → Structure | full 01–04 stepper |

Document this in UI copy: consumer never sees Structure/Pipeline tabs; developers see full Build flow under one L1 tab.

---

## 1. Consumer view (run shared pipelines)

Users with **no projects** (or who cleared active project) land in consumer mode at `/`.

```
/  (ConsumerShellLayout)
├── AppChromeHeader — Run | Build | Billing | Settings
├── AppWindowNav — Run tab only (when on Run section)
└── Main (activeWindow)
    ├── share → SharePage (consumer variant)
    │   ├── section: Shared with me
    │   │   └── SharedWithMePanel → paste link / saved links → openSharedRun()
    │   ├── section: Marketplace
    │   │   └── MarketplaceBrowsePanel → clone/browse templates
    │   └── [full-screen override] SharedLinkRunner (when activeSharedLinkId set)
    │       └── SharedRunPanel
    │           ├── InferenceInputSlot (per input step)
    │           ├── HumanReviewPanel (human-review steps)
    │           ├── InferenceStepTracePanel
    │           └── InferenceRunOutputs
    ├── billing → Billing (account)
    └── settings → Settings (account)
        ├── TeamSettings
        ├── Account / sign out
        ├── ModelSelector
        ├── LlmProvidersSettingsPage
        ├── JSON reader / syntax prefs
        ├── Logging / pipeline / inference toggles
        ├── Color scheme
        └── PrivacySettings
```

**Standalone shared run** (`/run/[id]`):

```
SharedRunViewer
├── Header — sign in/out, open in workspace
└── SharedRunPanel (same run UI as above)
    └── LazyDocViewer (document preview overlay)
```

Consumer panels: `CONSUMER_PANEL_IDS` in `components/app-shell-layout.tsx`.

---

## 2. Project selection (pre-workspace)

Before entering the builder, users pick or create a project at `/projects`:

```
/projects  (ProjectPickerPage)
├── Header — logo, "build pipelines", Back to run → /
└── Body
    ├── CTA — "Just want to run?" → /
    ├── Your pipelines — project list (open / rename / clone / delete)
    ├── ExampleTemplateGrid — bundled example projects
    ├── BlankProjectButton — new empty project
    └── MarketplaceBrowsePanel — clone from marketplace
```

If a signed-in user has **zero projects**, `StoreProvider` renders `NoProjectsPage` instead of the shell (same template/blank CTAs, no tabs).

Opening a project sets `activeProjectId` in session and navigates to `/` → **BuilderShellLayout**.

---

## 3. Pipeline creator / builder view

Once a project is active, `/` renders the full builder shell:

```
/  (BuilderShellLayout)
├── AppChromeHeader
│   ├── AppPrimaryNav — Run | Build | Billing | Settings
│   ├── ProjectSelector (when Build section active)
│   ├── RunningJobsHub
│   ├── ProjectAssistantDockToggle
│   ├── DiagnosisAgentHub
│   └── FeedbackButton
├── AppWindowNav — 12 numbered horizontal workspace tabs (hidden on account Billing/Settings)
├── ProjectAssistantDockLayout
│   ├── Main tab content (activeWindow)
│   └── ProjectAssistantDockPanel (optional trailing pane)
│       ├── Chat history list
│       └── ProjectAssistant → AssistantChat
└── LazyDocViewer (global document overlay)
```

### Builder workspace tabs → root components

| Tab | `activeWindow` | Root component | Step |
|-----|----------------|----------------|------|
| Structures | `structure` | `StructureBuilder` | 01 |
| Pipeline | `pipeline` | `PipelineBuilder` | 02 |
| Testing | `testing` | `Testing` | 03 |
| Inference | `inference` | `Inference` | 04 |
| Share | `share` | `SharePage` (builder variant) | 05 |
| Earnings | `earnings` | `Earnings` | 06 |
| Logging | `logging` | `Logging` | 07 |
| Cache | `cache` | `Cache` | 08 |
| Documents | `documents` | `Documents` | 09 |
| Docs | `docs` | `Documentation` | 10 |
| Billing | `project-billing` | `ProjectBilling` | 11 |
| Settings | `project-settings` | `ProjectSettings` (Langfuse toggle, etc.) | 12 |

Account **billing** / **settings** windows are separate — reached via L0 primary nav, not workspace tabs.

---

### 3.1 Structure tab (pipeline data models)

```
StructureBuilder
├── WindowHeader
├── ResizableSplit
│   ├── Sidebar (structs + types list)
│   │   ├── Struct list → select struct
│   │   ├── Type alias list → select type
│   │   └── "Code" view toggle
│   └── Main panel (view mode)
│       ├── view: structures + struct selected
│       │   └── StructureExcelEditor
│       │       ├── Field rows (name, type, optional, deterministic, examples)
│       │       ├── StructureFieldTypeEditor → TypeExprEditor / TypeBuilderPanel
│       │       ├── StructureFieldRefPicker
│       │       └── FieldExamplesEditorDialog
│       ├── view: structures + type selected
│       │   └── StructureTypeAliasEditor → TypeExprEditor
│       └── view: code
│           └── StructureCodeView (Pydantic / TS / Rust / Go / BAML preview)
```

### 3.2 Pipeline tab (step composition)

```
PipelineBuilder
├── WindowHeader + metrics bar (avg cost/time, cache count)
├── PipelineExportDialog
├── ResizableSplit
│   ├── PipelineCanvas (visual step chain)
│   │   ├── PipelineNode per step (input, LLM, batch LLM, example select, transform, merge, chunk, code, webhook, human review, output, auto-managed parse/quote, …)
│   │   ├── Insert slots (AddStepMenu)
│   │   └── PipelineSummaryBox (AI summary)
│   └── Inspector sidebar
│       └── InspectorCollapsibleSection → PipelineModuleFields
│           ├── shared.tsx — PipelineField, StructureModelSelect, IoMismatchFieldFix
│           ├── input-fields.tsx — InputModuleFields (file types, default doc)
│           ├── llm-fields.tsx — LlmModuleFields (prompt, model, schema)
│           ├── example-select-fields.tsx — ExampleSelectModuleFields (+ prompt cache preview)
│           ├── webhook-fields.tsx — WebhookModuleFields
│           ├── code-fields.tsx — CodeModuleFields → CustomCodeEditor
│           └── list-ops-fields.tsx — ListOpsModuleFields (transform / merge)
```

Step kinds map to `lib/types` `ModuleKind` and `MODULE_META` icons.

### 3.3 Testing tab

```
Testing
├── WindowHeader
├── ResizableSplit
│   ├── Test file list (*_testing.json docs)
│   └── TestFileEditor (testing-editor.tsx)
│       ├── Per-step expected outputs
│       ├── Input doc assignments
│       └── Run / parallel stale-test actions
├── TestResults (verdict after run)
└── GoToLoggingButton → logging tab
```

### 3.4 Inference tab

```
Inference
├── WindowHeader
├── ResizableSplit (setup sidebar | run panel)
│   ├── Setup list (*_inference.json) + InferenceSetupEditor
│   ├── InferenceRunPresetMenu (load test/setup presets)
│   └── Run panel
│       ├── InferenceInputSlot (per input module)
│       ├── InputCompatPanel
│       ├── RunWithStopButton
│       ├── HumanReviewPanel
│       ├── InferenceStepTracePanel → InferenceStepRow
│       ├── InferenceRunOutputs
│       ├── TestResults (when linked test)
│       ├── RunNotesPad
│       └── ErrorBanner / RunErrorSummary
```

### 3.5 Share tab (builder — publish & monetize)

```
SharePage (builder)
├── Sections: Publish | Shared with me | Marketplace | Activity
├── Publish (when pipeline valid)
│   ├── Publish tabs: Link | API | Marketplace
│   │   ├── ShareLinkForm (+ SharePricingFields, ShareDefaultFiles, ShareFundingPicker)
│   │   ├── HostApiForm
│   │   └── MarketplacePublishForm
│   └── DeploymentsList → DeploymentMonitor
├── Shared with me → SharedWithMePanel → SharedLinkRunner
├── Marketplace → MarketplaceBrowsePanel
└── Activity → DeploymentActivityPage
```

### 3.6 Logging tab

```
Logging
├── ResizableSplit (run list | detail)
│   ├── RunPickerColumn (search, errors-only filter)
│   └── Selected run detail
│       ├── ResizableSplit (pipeline canvas | step detail)
│       │   ├── PipelineCanvas (with step status overlay)
│       │   └── PipelineInspector → PipelineModuleFields (view mode)
│       ├── IoSection / IoPager
│       ├── LlmCallDistribution
│       ├── StepProfiling
│       ├── StepFailuresSection
│       ├── LlmRetryGridSection
│       ├── ExampleSelectVerdicts (kept/excluded candidates)
│       ├── StepServerLogsSection
│       ├── RunNotesEditor
│       ├── TestResults (for test runs)
│       └── IsolatedErrorActions → DiagnosisAgentHub
├── CompareModal
└── PopupModal (enlarged IO / JSON)
```

### 3.7 Other builder tabs (summary)

| Tab | Key child components |
|-----|---------------------|
| **Cache** | cache list + `JsonPreviewPanel`, `IoPager`, search toggles |
| **Documents** | upload zone, `DocProjectPicker`, file list, `PreviewBlockedDialog` |
| **Docs** | markdown editor + preview + mermaid pipeline graph (`Documentation`) |
| **Project billing** | per-project usage chart |
| **Project settings** | Langfuse export toggle, project-level prefs |
| **Earnings** | creator balance, withdraw to billing |
| **Account billing** | balance, `Chart` (usage over time), checkout, API keys |
| **Account settings** | `SETTINGS_SECTIONS` nav + `TeamSettings`, `PrivacySettings`, toggles |

### 3.8 Global builder overlays (not tabs)

| Overlay | Component | Trigger |
|---------|-----------|---------|
| Project agent dock | `ProjectAssistantDockLayout` + `AssistantChat` | Header "Agent" button |
| Diagnosis agents | `DiagnosisAgentHub` | Header hub / auto on failed runs |
| Running jobs | `RunningJobsHub` | Header — in-flight runs |
| Document viewer | `LazyDocViewer` | Click doc links anywhere |
| A/B testing | `AbTesting` | Spec'd; component exists, not yet wired to a tab |

---

## 4. shadcn/ui component mapping

### 4.1 Installed primitives (`components/ui/`)

These [shadcn/ui](https://ui.shadcn.com/docs/components) components are already in the repo:

| shadcn component | Used for |
|------------------|----------|
| **Sidebar** | `AppSidebar`, `SidebarProvider`, mobile nav |
| **Button** | Actions everywhere |
| **Input** | Search, rename, form fields, link paste |
| **Textarea** | Prompts, chat input, run notes, docs editor |
| **Label** | Form labels (login, share forms, host API) |
| **Select** | Field types, test editor, list-ops, code language |
| **Switch** | Toggles (optional fields, settings, privacy) |
| **Badge** | Status chips, step labels, deployment tags |
| **Tabs** | `SchemaJsonEditor`, export dialog file tabs |
| **Dropdown Menu** | Project selector, model selector, add-step menu, presets |
| **Tooltip** | Pipeline builder hints, testing tooltips |
| **Scroll Area** | Inference, logging, documents, cache lists |
| **Separator** | Sidebar internals |
| **Sheet** | Mobile sidebar drawer |
| **Skeleton** | Sidebar loading states |
| **Progress** | Run progress, step trace |
| **Slider** | (available; resizable splits are custom) |
| **Table** | (available; structure editor uses custom grid) |
| **Card** | (available; share publish uses custom bordered sections) |
| **Chart** | Billing usage area chart |
| **Sonner** | Toast notifications |

### 4.2 Recommended shadcn components to add

| shadcn component | Where to use | Replaces / improves |
|------------------|--------------|---------------------|
| [**Dialog**](https://ui.shadcn.com/docs/components/dialog) | `FieldExamplesEditorDialog`, `CompareModal`, `PipelineExportDialog`, `PreviewBlockedDialog` | Custom modal markup |
| [**Alert Dialog**](https://ui.shadcn.com/docs/components/alert-dialog) | Delete project, delete step, withdraw earnings | `window.confirm` patterns |
| [**Alert**](https://ui.shadcn.com/docs/components/alert) | `ErrorBanner`, validation banners in Structure/Pipeline | Custom destructive divs |
| [**Popover**](https://ui.shadcn.com/docs/components/popover) | `InferenceInputPickerPopup`, structure ref picker | Custom positioned panels |
| [**Command**](https://ui.shadcn.com/docs/components/command) | Project selector search, document picker, add-step palette | Long dropdown lists |
| [**Combobox**](https://ui.shadcn.com/docs/components/combobox) | `ModelSelector`, structure model select | Dropdown-only model pick |
| [**Accordion**](https://ui.shadcn.com/docs/components/accordion) | `InspectorCollapsibleSection`, logging step detail | Custom collapsible |
| [**Collapsible**](https://ui.shadcn.com/docs/components/collapsible) | Settings sections, diagnosis debug | Custom expand/collapse |
| [**Resizable**](https://ui.shadcn.com/docs/components/resizable) | All `ResizableSplit` panes | Custom drag-handle splits |
| [**Drawer**](https://ui.shadcn.com/docs/components/drawer) | Mobile doc viewer, agent dock on small screens | Full-width overlays |
| [**Empty**](https://ui.shadcn.com/docs/components/empty) | No projects, no tests, no runs | Plain text placeholders |
| [**Field**](https://ui.shadcn.com/docs/components/field) | Share forms, host API, login | Ad-hoc label+input stacks |
| [**Checkbox**](https://ui.shadcn.com/docs/components/checkbox) | Cache search field toggles, bulk select | Custom buttons |
| [**Radio Group**](https://ui.shadcn.com/docs/components/radio-group) | `ShareFundingPicker`, billing scope | Custom button groups |
| [**Pagination**](https://ui.shadcn.com/docs/components/pagination) | Deployment activity, long run lists | Scroll-only lists |
| [**Breadcrumb**](https://ui.shadcn.com/docs/components/breadcrumb) | `SharedLinkRunner` back nav, settings depth | Plain back buttons |
| [**Spinner**](https://ui.shadcn.com/docs/components/spinner) | `Loader2` lucide usage | Inconsistent loading icons |
| [**Toast**](https://ui.shadcn.com/docs/components/toast) | Copy feedback, save confirmations | Inline "copied" state |
| [**Data Table**](https://ui.shadcn.com/docs/components/data-table) | `StructureExcelEditor`, deployment activity | Hand-rolled tables |
| [**Calendar**](https://ui.shadcn.com/docs/components/calendar) + **Date Picker** | Activity filters, billing date range | Not yet implemented |

### 4.3 Chat / AI UI mapping (`chadcn_components.md`)

Current chat UIs are custom (`AssistantChat`, `ProjectAssistant`, diagnosis agents). Mapping to community kits:

| App surface | Current component | Recommended kit / shadcn mapping |
|-------------|-------------------|----------------------------------|
| Project agent dock | `AssistantChat` + `ProjectAssistant` | [**shadcn-chat**](https://ui.shadcn.com/) `Chat`, `ChatList`, `ChatBubble`, `ChatInput` — or [**Prompt Kit**](https://ui.shadcn.com/) `PromptInput`, `MessageThread` |
| Structure assistant | (via structure API) | `Message` + `ChatInput` from **chat-components** (markdown, copy, edit actions) |
| Pipeline assistant | (via pipeline API) | Same as above; add `GenerationStatus` for streaming |
| Human review step | `HumanReviewPanel` | **assistant-ui** `Thread` + `Composer` (file attach, voice) |
| Diagnosis agents | `DiagnosisAgentHub` | **assistant-ui** `AssistantPopover` for inline debug |
| Shared run chat-until-resolution | `HumanReviewPanel` in `SharedRunPanel` | **shadcn-chat** `ChatList` with auto-scroll ([Message Scroller](https://ui.shadcn.com/docs/components)) |
| Model picker in chat | `ModelSelector` | **Prompt Kit** `ModelSelector` or shadcn **Combobox** |

New shadcn primitives relevant to chat (from [components index](https://ui.shadcn.com/docs/components)):
- **Message**, **Message Scroller**, **Bubble**, **Attachment** — replace custom bubble classes in `assistant-chat.tsx`
- **Kbd** — keyboard shortcuts in chat input (send, stop generation)

### 4.4 Per-area quick reference

| UI area | Primary shadcn (installed) | Add next |
|---------|---------------------------|----------|
| App shell / nav | Sidebar, Button, Dropdown Menu, Tooltip | Breadcrumb, Drawer (mobile) |
| Structure editor | Button, Badge, Switch, Select | Data Table, Dialog, Popover, Field |
| Pipeline canvas | Badge, Button, Dropdown Menu, Tooltip | Resizable, Command (add step), Alert |
| Pipeline inspector | Input, Textarea, Switch, Select | Accordion, Field |
| Inference / shared run | Button, Badge, Scroll Area, Progress | Alert, Dialog, Empty |
| Testing | Button, Badge, Scroll Area, Textarea, Tooltip, Select | Data Table, Alert |
| Logging | Button, Badge, Input, Scroll Area | Dialog, Accordion, Tabs |
| Share / marketplace | Button, Input, Label, Badge | Field, Radio Group, Card, Empty |
| Billing / earnings | Button, Badge, Chart | Alert, Dialog (confirm withdraw) |
| Settings | Button, Switch | Tabs, Accordion, Field |
| Login | Button, Input, Label | Card, Alert (errors) |
| Chat / agents | Button, Textarea | Message, Message Scroller, Bubble (shadcn); or kits from `chadcn_components.md` |