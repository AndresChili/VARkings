import { MatchesClient } from '@/components/matches/matches-client';
import { DEMO_MATCHES, DEMO_PREDICTION_MAP } from '@/lib/demo/demo-data';

export default function DemoMatchesPage() {
  return (
    <>
      {/* El torneo demo ya terminó: sin esto, el filtro por defecto ("próximos") se vería vacío. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(!sessionStorage.getItem('matches-filter'))sessionStorage.setItem('matches-filter','finished')}catch(e){}`,
        }}
      />
      <MatchesClient basePath="/demo" matches={DEMO_MATCHES} predictionMap={DEMO_PREDICTION_MAP} />
    </>
  );
}
