let smartClient = null;
let launchedPatient = null;

function getPatientName(patient) {
  if (!patient.name || !patient.name.length) return "(no name)";
  const n = patient.name[0];
  return `${(n.given || []).join(" ")} ${n.family || ""}`.trim();
}

function showOutput(obj) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  document.getElementById("output").textContent = text;
}

function buildCommunication(patient) {
  return {
    resourceType: "Communication",
    status: "in-progress",
    subject: {
      reference: `Patient/${patient.id}`,
      display: getPatientName(patient)
    },
    category: [
      {
        text: "Provider message"
      }
    ],
    payload: [
      {
        contentString: "Patient appears due for FIT screening. Please review."
      }
    ]
  };
}

async function createOneCommunication() {
  try {
    document.getElementById("status").textContent = "Creating Communication...";

    const payload = buildCommunication(launchedPatient);

    const result = await smartClient.request("Communication", {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json"
      },
      body: JSON.stringify(payload)
    });

    document.getElementById("status").textContent = "Communication create call succeeded";
    showOutput({
      message: "Communication created",
      submittedPayload: payload,
      serverResponse: result
    });
  } catch (error) {
    document.getElementById("status").textContent = "Communication create failed";

    const details = {
      message: error?.message || "Unknown error"
    };

    if (error?.status) {
      details.httpStatus = error.status;
    }

    if (error?.response) {
      try {
        details.responseBody = await error.response.text();
      } catch (e) {
        details.responseBody = "Could not read response body";
      }
    } else if (error?.stack) {
      details.stack = error.stack;
    }

    showOutput(details);
    console.error(error);
  }
}

FHIR.oauth2.ready()
  .then(async function (client) {
    smartClient = client;

    if (!client.patient || !client.patient.id) {
      throw new Error("No patient context was provided in this launch.");
    }

    const patient = await client.patient.read();
    launchedPatient = patient;

    document.getElementById("status").textContent = "Launch succeeded";

    document.getElementById("patientSummary").innerHTML = `
      <p><b>Name:</b> ${getPatientName(patient)}</p>
      <p><b>DOB:</b> ${patient.birthDate || ""}</p>
      <p><b>Gender:</b> ${patient.gender || ""}</p>
      <p><b>Patient ID:</b> ${patient.id || ""}</p>
    `;

    document.getElementById("createBtn").disabled = false;
    document.getElementById("createBtn").addEventListener("click", createOneCommunication);

    showOutput({
      info: "Ready to create one Communication",
      patientId: patient.id,
      serverUrl: client.state?.serverUrl || null
    });
  })
  .catch(function (error) {
    document.getElementById("status").textContent = "SMART launch failed";
    showOutput(error?.stack || error?.message || error);
    console.error(error);
  });