import { MascotColumn, MascotSlot, PageColumns, PageHeader } from "@/components/shell/PageColumns";
import styles from "./page.module.css";

export default function Home() {
  return (
    <PageColumns
      mascot={
        <MascotColumn caption="Ready when you are">
          <MascotSlot />
        </MascotColumn>
      }
    >
      <PageHeader title="New chat" />
      <div className={styles.body}>
        <p className={styles.placeholder}>Your Automatos, the fun way. Chat with Auto is coming soon.</p>
      </div>
    </PageColumns>
  );
}
