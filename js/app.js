let smartClient = null;
let launchedPatient = null;

function getPatientName(patient) {
  if (!patient.name || !patient.name.length) return "(no name)";
  const n = patient.name[0];
  const given = (n.given || []).join(" ");
  const family = n.family || "";
  return `${given} ${family}`.trim();
}

function showOutput(obj) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  document.getElementById("output").textContent = text;
}

function findBestIdentifier(patient) {
  if (!patient.identifier || !patient.identifier.length) return "(no identifier)";
  const mrn = patient.identifier.find(id => id.system && id.system.includes("hospital"));
  return mrn?.value || patient.identifier[0]?.value || "(no identifier)";
}

function buildFitServiceRequest(patient, client) {
  // This is a starter payload.
  // You will likely need to replace category/code with valid Millennium values.
  return {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "order",
    priority: "routine",
    subject: {
      reference: `Patient/${patient.id}`,
      display: getPatientName(patient)
    },
    // Encounter is often present in launched Cerner context, but not guaranteed.
    ...(client.getEncounterId && client.getEncounterId()
      ? { encounter: { reference: `Encounter/${client.getEncounterId()}` } }
      : {}),
    authoredOn: new Date().toISOString(),
    category: [
      {
        text: "Laboratory"
      }
    ],
    code: {
      text: "FIT test"
    },
    note: [
      {
        text: "Created by SMART app demo"
      }
    ]
  };
}

async function createOneServiceRequest() {
  try {
    document.getElementById("status").textContent = "Creating ServiceRequest...";

    const payload = buildFitServiceRequest(launchedPatient, smartClient);

    // Using a direct FHIR POST. This is the key write step.
    const result = await smartClient.request("ServiceRequest", {
      method: "POST",
      headers: {
        "Content-Type": "application/fhir+json"
      },
      body: JSON.stringify(payload)
    });

    document.getElementById("status").textContent = "ServiceRequest create call succeeded";
    showOutput({
      message: "ServiceRequest created",
      submittedPayload: payload,
      serverResponse: result
    });
  } catch (error) {
    document.getElementById("status").textContent = "ServiceRequest create failed";

    let details = {
      message: error?.message || "Unknown error"
    };

    if (error?.response) {
      details.httpStatus = error.status || error.response.status;
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

    console.log("SMART ready");
    console.log("serverUrl:", client.state?.serverUrl);
    console.log("patient id from context:", client.patient?.id);
    console.log("token response:", client.state?.tokenResponse);

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
      <p><b>Identifier:</b> ${findBestIdentifier(patient)}</p>
    `;

    document.getElementById("createOrderBtn").disabled = false;
    document.getElementById("createOrderBtn").addEventListener("click", createOneServiceRequest);

    showOutput({
      info: "Ready to create one ServiceRequest",
      patientId: patient.id,
      serverUrl: client.state?.serverUrl || null
    });
  })
  .catch(async function (error) {
    document.getElementById("status").textContent = "SMART launch failed";

    const details = {
      message: error?.message || "Unknown error",
      stack: error?.stack || null
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
    }

    showOutput(details);
    console.error(error);
  });
