It's easy to regress if you forget about a feature.
This is all of them.


Tabs :
projects 
structure 
pipeline 
inference 
share
logging
documents 
billing 
settings


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
preview code of structures with pydantic or zod and syntax highlighting
ask an ai assistant to change the models for you



You need to have a page which doesn't edit structs but just single types. so you can click on a placeholder and add a dict or a list and then fill out what's in that list etc. allow any inline type that you would in python like list[list[int]] or dict[str, str] or new types like quote_id_t or unfilled types like set[UNSET].


each structure should have a quick AI summarise button, which is not meant to replace human descriptions, but to quickly catch bugs or inconsistencyies like "document_summary : int".


each of the fields will have a boolean for if something is deterministic

if a struct is auto generated then lock it.

# Pipeline

A central visualisation of all steps of the pipeline with boxes for each step and a descrpition and associated icon.

steps include 

1. input - select a any subset of input types like pdf, word not just 1. select doucment to be default.
2. custom function - typescript or python, with built in fallback system
single llm call
3. parallel llm call - ensuring this completes in a similar time to the single call.
4. output (there can be multiple per pipeline)


  transform which converts a list into a single pydantic / zod model with a field containing that list


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


add an export to python button to export the whole pipeline to python, including the front end UI. this should include a lot of supabase info so maybe use sql, plus some derived errors like validation.
there should be an assert to check no env keys are in the export
export should have a readme file and instructions for how to setup a scalable API using the existing code.

there should be an export pipeline to code,
the pop up showns download buttons button to export to typescript and python.


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

# inference

All inputs are shown with the option to select documents.
documents are filtered based on if they adhere to the restrictions of the input model like file type or json structure. 
So you can either say, i only want pdfs or i only want json which is of this structure. 
files are already uploaded into documents, and you can select from these, with filtering based on name and extension completed.
there is a run button,
when you click it a live server log appears. when the run is completed there is a button directing users to the logging tab. server logs displayed should be broken down by step in the pipeline.
there is a text field to put a description of why you are doing this run which you can edit in logging and saerch for later to organiase your runs.
if you do a run that has already been completed the same setup, there is a button that appears to go to the log and not to run.
documents are selected from the documents tab to avoid repeat uplaods, latency in upload, and work in converting to text.

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


# logging
The logging tab contains all the history. each log is either red or green depending on if it passed or failed.
you can search for runs, based on descriptions provided and editable when selecting the run.
logging for each run contains each steps input and output syntax highlghted, with the model linked that the json is formatted in. 
each input has a link back to the original document.
there are graphs for llm calls of the distribution of the number of characters for each input prompt and output response, and a graph of the response latency. 

Any source docments which are used for extraction of quotes, are highlighted in a color to seperate it. there is also a link back to that doucment and any quotes which are extracted can be clicked on to see the highlighted region of the text the quote is from with the ability to scroll. although the prompt or response might contain json that isn't noted, there should be an automatic json extractor which should sepearte json and add syntax highlighting.
Quotes are validated in a method that is not brute force and doesn't look through the whole dictionary, but instead uses the structs to know where quotes to validate are located. 

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

# documents

the documents tab contains all documents and their size with the ability to view them. you can also view pdf documents markdown in raw text or as formatted or as the original pdf and the same for word and other more complex documents. 
csv, excel, json can all be viewed as json, excel or in original text.
flag and block uploads if they contain 'confidential' until you click approve

uploading a new document will check if it matches any of the existing structs and display this. you have the option to add any new structures in the document.

when viewing a pdf or image you need to options to see 
1. raw markdown text
2. formatted markdown
3. pdf
4. OCR labelled

an option for csvs and also for files like excel, csv or json to automatically derive their excel structures . you should be able to go into the doucments tab and click any of the derived pydantic zod models to add to strcutres, then those structures should link back to the original document with a clickable link to show where they came from

on any tab if you are viewing some json, in the unified viewer where you can switch between json, excel and a tree structure, you have a download button

for any json structure or excel csv, if you load a file into the system, it auto finds which structs match and also derives any parts of the structure that do no match. like say you had an existing struct Tree[Node] but you input CyclicGraph[Node]. the system would match Node as the same but add the new Cyclic graph struct immedialy after uploading. this would also be done for existing files already uploaded

by default documents are tied to the project they're uploaded to. however they can be selected in a list what projects they're available in.



# Billing 
current credit.
brekadown of spend between different models sorted by most spend. 
the ability to top up or subscribe to add tokens and a refresh button.
cache savings.
graph of dates and spending to see when spending decreases or increasesm, including total and model breakdown.


# Settings
select which type of json syntax highlighting 
  App
  Pipeline / log output — green strings, blue keys, orange numbers

  Editor
  Classic code editor — peach strings, cyan keys

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

you can resize different parts of the UI with ResizableSplit.


# history and merging changes 

Copy this - using git :
An integrated revision and branching system for colaboration, changes merging, and history
"""
For true 3D software with built-in version control featuring Git-like branching and commit changes, your primary options are cloud-native platforms like Onshape or multi-user ecosystems like Autodesk Fusion.
"""



# landing page

be able to put a prompt in on the landing page website and it run. obv put rate limits and use cheap model, please put into the supabase set up as billed to landing page, and have a landing page budget and record the list of calls. need a more interactive and engaging live demo than a bunch of random tabs

To get a clear idea of the app please have
  1. A text box with an enter button for a task you would like to automate which when pressed builds a full pipline
  2. A preview of the whole app with no run buttons working.


have a live preview on the landing page 
have a try now button which links to sign in 

have a button to book a demo in calendar using https://cal.com/




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