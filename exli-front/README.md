### to run the Backend service via gcloud got to the backend folder and type 
gcloud run deploy exli-processor --source .

### to run the front end go to exli-front and type
npm run dev

then click the link to the browser


for logging in terminal type this
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=exli-processor AND severity>=INFO" --limit 20 --format="value(textPayload)"