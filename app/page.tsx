import { AutoMascot } from "@/components/mascot/AutoMascot";
import { MascotColumn, PageColumns, PageHeader } from "@/components/shell/PageColumns";
import styles from "./page.module.css";

export default function Home() {
  return (
    <PageColumns
      mascot={
        <MascotColumn>
          <AutoMascot state="idle" />
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
