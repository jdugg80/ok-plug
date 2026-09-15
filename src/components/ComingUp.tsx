import styles from "./ComingUp.module.css";

interface ComingUpProps {
  title: string;
  phase: string;
  description: string;
  dependsOn?: string;
}

export function ComingUp({ title, phase, description, dependsOn }: ComingUpProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.phase}>{phase}</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {dependsOn && <p className={styles.dependsOn}>Depends on: {dependsOn}</p>}
    </div>
  );
}
