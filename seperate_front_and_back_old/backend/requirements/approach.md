i'm creating a demo, i want to make a front end prototype (done) and then a backend prototype (progress) and then combine. 
Pure backend demo should be in backend folder so you can build the backend without worrying about front end.
Don't use python as pure client side js for simplicity. 
Only use UI to hit openrouter.

backend should make actual openrouter requests, as i need to test.
There should not be a seperate backend server when combining the ui and backend, for simplicity.


i've got seed content docs here 
documents/company_for_assessment.pdf
documents/legal_doc_text.pdf

documents/latex/company_for_assessment.tex
documents/latex/legal_doc_text.tex


I want you to build a full typescript backend in /backend
which you will later combine with the V0 prototype.
I'm doing things in steps to make things easier.





for the database, given we need to handle sign ins at some point, a managed system like supabase would be ideal. However, you can build the prototype at first with the simplest possible local approach (local json), with notes on how to make the transition later. 