BoundaryML or BAML - https://boundaryml.com/ - Boundry ML does seem interesting. it's a library for helping with prompting, with a bit more type safety, and the schema validation we're looking to use. They've also done some of the nondetemrinism / deterministic / probablisitic logic we're using. BAML Workflow View does have some overlap. It's not a full 1.0 version yet. They're trying to replace traditional coding language, while our approach is more to wrap the existing approach with current langauges like python to be more abstracted. 
instructor - https://useinstructor.com/ - This is a library to return results in schemas, like pydantic, but it only supoprts openAI clients. you need to make a new client for each response model. It's not to the scale of what we're trying to build. we also want to support non open ai style apis and all the other features we're trying to build.
Vellum AI - https://www.vellum.ai/ - I've used this a bit. It's kind of a custom agent for local use for employees in their daily tasks. It's not meant for scalable production pipelines.
LlamaExtract (part of LlamaCloud) - While LlamaExtract does have schema based extraction, it only does document ingestion.
Relevance AI - isn't designed for the kind of high thoughput pipelines i'm envisioning. It doesn't have the ability to handle a dyanmic number of request and maxed out at 10 agents at a time when i tested it, but then said it could do more. It could use python, but it wasn't on rails like it could be with structured outputs. It also failed when i tried to use it. I would call it a close competitor, but it's a different approach and scale.
haystack (deepset) - https://haystack.deepset.ai/ - looks very simple if i'm honest. It's just a library.
Gumloop AI - https://www.gumloop.com/ - one of the best i've seen. it was able to build me an agent to gather lots of quantum encryption data for a releatively cheap price.  and it was also able to extract rules into automic pieces and run that against a company's documentation. I think the only thing is that it's kind of hard to know things are verified because it's a full agent apporach. 
https://pydantic.dev/logfire - looks very good, but it's just logs and doesn't cover the full stack. Logfire is built on OpenTelemetry. I don't like how every single AI frameowkr makes their own agent class which works slightly differently. It's not like you can combine these and they're probably not optimised if they're designed by a small team. I think claude code would be the most optimised agent and prompt available and the only reason log fire has it's own agent is to monitor everything which seems like a bad idea.
Dify AI - https://dify.ai/ - dify looks quite good. i like their node editor, but their UI is a bit amatuer and it doesn't inspire confidence. You're not able to export to code. Good list of integrations. 

TODO check if gum loop can export parts of pipelines as an API


TODO closest competitors





OpenTelemetry





Wordware AI - https://www.wordware.ai/
Windmill AI - https://www.windmill.dev/windmill_ai
Flowise / Langflow AI