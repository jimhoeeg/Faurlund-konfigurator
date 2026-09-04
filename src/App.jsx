import FaurlundHavePartner from "./components/FaurlundHavePartner.jsx";

/**
 * Demo-side. I produktion indlejres modulet blot ét sted på faurlund.dk:
 *
 *   <FaurlundHavePartner onLead={(rapport) => sendTilCrm(rapport)} />
 */
export default function App() {
  return (
    <div className="min-h-screen px-0 py-0 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <FaurlundHavePartner
          onLead={(rapport) => {
            // Her kobles modulet på CRM, e-mailflow eller webhook.
            console.log("Lead klar til afsendelse:", rapport);
          }}
        />
      </div>
    </div>
  );
}
