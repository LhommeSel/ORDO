import type {
  GovernmentDoctrine,
  PoliticalActionProfile,
  PoliticalPathway,
  WorldState,
} from './types';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

function doctrineCompatibility(
  government: GovernmentDoctrine,
  requested: Partial<GovernmentDoctrine>,
) {
  const entries = Object.entries(requested) as Array<[
    keyof GovernmentDoctrine,
    number,
  ]>;
  if (!entries.length) return 70;
  const averageDistance = entries.reduce(
    (sum, [key, value]) => sum + Math.abs(government[key] - value),
    0,
  ) / entries.length;
  return clamp(100 - averageDistance);
}

export function evaluatePoliticalPathway(
  state: WorldState,
  countryId: string,
  profile: PoliticalActionProfile,
): PoliticalPathway {
  const country = state.countries[countryId];
  if (!country) throw new Error(`Pays inconnu : ${countryId}`);
  const politics = country.politics;
  const compatibility = doctrineCompatibility(politics.doctrine, profile.doctrine);
  const votesRequired = Math.floor(politics.legislatureSeats / 2) + 1;
  const ideologicalDefection = Math.round(
    politics.governingSeats * clamp((60 - compatibility) / 100, 0, 0.45),
  );
  const votesAvailable = Math.max(0, politics.governingSeats - ideologicalDefection);
  const administrativeFeasibility = clamp(
    politics.administrativeCompliance - profile.administrativeComplexity * 0.35,
  );
  const obstacles: string[] = [];
  const routes: string[] = [];

  if (compatibility < 45) obstacles.push('Doctrine gouvernementale peu compatible');
  if (votesAvailable < votesRequired) obstacles.push(`Majorité insuffisante : ${votesAvailable}/${votesRequired} voix estimées`);
  if (administrativeFeasibility < 50) obstacles.push('Mise en œuvre administrative fragile');
  if (profile.publicSalience > politics.publicApproval + 20) obstacles.push('Opinion insuffisamment préparée');

  if (profile.requiredAuthority === 'executive' && compatibility >= 55 && administrativeFeasibility >= 50) {
    return {
      status: 'direct', doctrineCompatibility: Math.round(compatibility), votesAvailable,
      votesRequired, administrativeFeasibility: Math.round(administrativeFeasibility), obstacles,
      routes: ['Décision exécutive', 'Décret ou instruction gouvernementale'],
    };
  }

  if (profile.requiredAuthority === 'administrative' && administrativeFeasibility >= 55) {
    return {
      status: compatibility >= 45 ? 'direct' : 'negotiable', doctrineCompatibility: Math.round(compatibility),
      votesAvailable, votesRequired, administrativeFeasibility: Math.round(administrativeFeasibility), obstacles,
      routes: compatibility >= 45 ? ['Instruction administrative'] : ['Reformuler la mesure comme expérimentation technique', 'Remplacer les responsables opposés'],
    };
  }

  if (profile.requiredAuthority === 'constitutional') {
    const superMajority = Math.ceil(politics.legislatureSeats * 0.6);
    return {
      status: votesAvailable >= superMajority && compatibility >= 50 ? 'legislative' : 'rupture',
      doctrineCompatibility: Math.round(compatibility), votesAvailable, votesRequired: superMajority,
      administrativeFeasibility: Math.round(administrativeFeasibility), obstacles,
      routes: votesAvailable >= superMajority
        ? ['Révision constitutionnelle']
        : ['Construire une coalition constitutionnelle', 'Organiser un référendum si le régime le permet', 'Assumer une rupture institutionnelle'],
    };
  }

  if (votesAvailable >= votesRequired && compatibility >= 40) {
    routes.push('Projet de loi gouvernemental');
    if (compatibility < 60) routes.push('Négocier des amendements avec la majorité');
    return {
      status: compatibility >= 60 ? 'legislative' : 'negotiable', doctrineCompatibility: Math.round(compatibility),
      votesAvailable, votesRequired, administrativeFeasibility: Math.round(administrativeFeasibility), obstacles, routes,
    };
  }

  const voteGap = votesRequired - votesAvailable;
  if (voteGap <= Math.ceil(politics.legislatureSeats * 0.12)) {
    return {
      status: 'negotiable', doctrineCompatibility: Math.round(compatibility), votesAvailable, votesRequired,
      administrativeFeasibility: Math.round(administrativeFeasibility), obstacles,
      routes: ['Négocier un accord parlementaire', 'Réduire la portée du projet', 'Attendre une fenêtre de crise ou une alternance'],
    };
  }

  return {
    status: compatibility < 25 ? 'rupture' : 'blocked', doctrineCompatibility: Math.round(compatibility),
    votesAvailable, votesRequired, administrativeFeasibility: Math.round(administrativeFeasibility), obstacles,
    routes: compatibility < 25
      ? ['Préparer une alternance politique', 'Modifier la coalition', 'Assumer une crise gouvernementale']
      : ['Convaincre l’opinion', 'Construire une coalition', 'Représenter ultérieurement le projet'],
  };
}
