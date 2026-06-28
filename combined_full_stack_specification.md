It's easy to regress if you forget about a feature.
This is all of them.


Tabs :
projects 
structure 
pipeline 
inference 
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

# example projects

  1. a company legal evaluation, where you provide a document about legal requirements for some type of company and then a document of what that company has done to comply with regulation. what is produced is an excel file which has broken down the atomic rules and if they are followed or not. use parallel llm calls by breaking down the legal requirements into atomic rules. accept diverse inputs.

  2. Legacy SQL migration. Perform mapping of old table field names to new table field names and where data is likely to flow. include a field which gives python code for how to produce field if mapping is many to 1 or many to 1.

  3. GPS site profiling. Provided some set of coordinates, using inherint knowledge of llms, profile the similarities in the sites and what the connecting feature like 'russian nuclear bases', 'scenic waterfalls', or 'towns named jeremy'. Use parallel llm calls.

  4. Parallel llm example. Run llm calls in parallel. Simplest example where llms answer 10 trivia questions at the same time and return a list of answers.




# description
text editor and optional markdown preview for a description of a project

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
