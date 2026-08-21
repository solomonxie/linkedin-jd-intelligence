// Curated reference of common technical skills and what they typically imply,
// grouped by category. Given to the model as grounding for the requirement
// tree's "implied" children (see promptBuilder's REQUIREMENT TREE section) —
// not exhaustive, the model still uses judgment for anything not listed here.
// Deliberately technical-only: no soft skills, no "communication"/"collaboration".

export interface SkillPreset {
  skill: string;
  implies?: string[];
}

export interface SkillCategory {
  category: string;
  skills: SkillPreset[];
}

export const SKILL_PRESETS: SkillCategory[] = [
  {
    category: "Languages",
    skills: [
      { skill: "Python" },
      { skill: "JavaScript" },
      { skill: "TypeScript", implies: ["JavaScript"] },
      { skill: "Java" },
      { skill: "Go" },
      { skill: "C#" },
      { skill: "C++" },
      { skill: "C" },
      { skill: "Rust" },
      { skill: "Ruby" },
      { skill: "PHP" },
      { skill: "Kotlin", implies: ["JVM"] },
      { skill: "Swift" },
      { skill: "Scala", implies: ["JVM"] },
      { skill: "R" },
    ],
  },
  {
    // Generic phrasing a posting sometimes uses instead of naming a specific
    // language (e.g. "proficiency in at least one scripting language") — the
    // three categories overlap in practice but are distinct axes, so each
    // gets its own implied set rather than being folded into one.
    category: "Language paradigms (generic JD phrasing)",
    skills: [
      { skill: "Scripting language", implies: ["Python", "JavaScript", "Ruby", "PHP", "Bash/Shell", "Perl"] },
      { skill: "Compiled language", implies: ["C", "C++", "Go", "Rust", "Java", "C#"] },
      {
        skill: "Statically-typed language",
        implies: ["TypeScript", "Java", "C#", "Go", "Rust", "C++", "Kotlin", "Swift"],
      },
    ],
  },
  {
    category: "Backend web frameworks",
    skills: [
      { skill: "Django", implies: ["Python", "ORM", "REST API design", "web-app development"] },
      { skill: "FastAPI", implies: ["Python", "REST API design", "async I/O"] },
      { skill: "Flask", implies: ["Python", "REST API design"] },
      { skill: "Spring / Spring Boot", implies: ["Java", "REST API design", "dependency injection"] },
      { skill: "Ruby on Rails", implies: ["Ruby", "ORM", "MVC"] },
      { skill: "Express", implies: ["Node.js", "REST API design"] },
      { skill: "NestJS", implies: ["Node.js", "TypeScript", "REST/GraphQL API"] },
      { skill: "ASP.NET Core", implies: ["C#", "REST API design"] },
      { skill: "Laravel", implies: ["PHP", "ORM", "MVC"] },
      { skill: "Node.js", implies: ["JavaScript"] },
    ],
  },
  {
    category: "Frontend",
    skills: [
      { skill: "React", implies: ["JavaScript/TypeScript", "component-based UI"] },
      { skill: "Next.js", implies: ["React", "server-side rendering"] },
      { skill: "Vue", implies: ["JavaScript/TypeScript"] },
      { skill: "Angular", implies: ["TypeScript"] },
      { skill: "Svelte", implies: ["JavaScript/TypeScript"] },
      { skill: "HTML/CSS" },
      { skill: "Tailwind CSS", implies: ["CSS"] },
      { skill: "Redux", implies: ["React", "state management"] },
    ],
  },
  {
    category: "Databases & storage",
    skills: [
      { skill: "PostgreSQL", implies: ["relational database design", "SQL"] },
      { skill: "MySQL", implies: ["relational database design", "SQL"] },
      { skill: "SQL Server", implies: ["relational database design", "SQL"] },
      { skill: "SQLite", implies: ["relational database design", "SQL"] },
      { skill: "MongoDB", implies: ["NoSQL/document database design"] },
      { skill: "Redis", implies: ["caching", "in-memory data store"] },
      { skill: "Cassandra", implies: ["NoSQL/wide-column database", "distributed systems"] },
      { skill: "DynamoDB", implies: ["NoSQL database design", "AWS"] },
      { skill: "Elasticsearch", implies: ["search/indexing"] },
      { skill: "ClickHouse", implies: ["columnar/analytical database experience"] },
      { skill: "Snowflake", implies: ["data warehousing", "SQL"] },
      { skill: "BigQuery", implies: ["data warehousing", "SQL", "GCP"] },
    ],
  },
  {
    category: "Data engineering & ML",
    skills: [
      { skill: "Spark", implies: ["distributed data processing", "likely data-lake/Delta Lake context"] },
      { skill: "Airflow", implies: ["workflow orchestration"] },
      { skill: "Kafka", implies: ["event streaming", "asynchronous messaging"] },
      { skill: "dbt", implies: ["SQL", "data transformation/modeling"] },
      { skill: "Pandas", implies: ["Python", "data manipulation"] },
      { skill: "NumPy", implies: ["Python", "numerical computing"] },
      { skill: "Parquet", implies: ["columnar storage format"] },
      { skill: "PyTorch", implies: ["Python", "deep learning"] },
      { skill: "TensorFlow", implies: ["Python", "deep learning"] },
      { skill: "scikit-learn", implies: ["Python", "classical ML"] },
      { skill: "Hadoop", implies: ["distributed data processing"] },
    ],
  },
  {
    category: "Cloud & infrastructure",
    skills: [
      { skill: "AWS" },
      { skill: "GCP" },
      { skill: "Azure" },
      { skill: "Terraform", implies: ["infrastructure as code"] },
      { skill: "CloudFormation", implies: ["AWS", "infrastructure as code"] },
      { skill: "Pulumi", implies: ["infrastructure as code"] },
      { skill: "SQS", implies: ["AWS", "asynchronous messaging"] },
      { skill: "SNS", implies: ["AWS", "pub/sub messaging"] },
      { skill: "Lambda", implies: ["AWS", "serverless"] },
      { skill: "S3", implies: ["AWS", "object storage"] },
      { skill: "RabbitMQ", implies: ["asynchronous/event-driven messaging"] },
    ],
  },
  {
    category: "Containers & orchestration",
    skills: [
      { skill: "Docker", implies: ["containerization"] },
      { skill: "Kubernetes", implies: ["container orchestration", "Docker"] },
      { skill: "Helm", implies: ["Kubernetes"] },
      { skill: "ECS", implies: ["AWS", "container orchestration"] },
    ],
  },
  {
    category: "DevOps, CI/CD & observability",
    skills: [
      { skill: "Jenkins", implies: ["CI/CD pipelines"] },
      { skill: "GitHub Actions", implies: ["CI/CD pipelines"] },
      { skill: "GitLab CI", implies: ["CI/CD pipelines"] },
      { skill: "CircleCI", implies: ["CI/CD pipelines"] },
      { skill: "Ansible", implies: ["configuration management"] },
      { skill: "Prometheus", implies: ["metrics/monitoring"] },
      { skill: "Grafana", implies: ["metrics dashboards/monitoring"] },
      { skill: "Datadog", implies: ["monitoring/observability"] },
      { skill: "ELK stack", implies: ["log aggregation/observability"] },
    ],
  },
  {
    category: "Testing",
    skills: [
      { skill: "Jest", implies: ["JavaScript/TypeScript", "unit testing"] },
      { skill: "PyTest", implies: ["Python", "unit testing"] },
      { skill: "Selenium", implies: ["browser automation/E2E testing"] },
      { skill: "Cypress", implies: ["E2E testing"] },
      { skill: "JUnit", implies: ["Java", "unit testing"] },
    ],
  },
  {
    category: "Mobile",
    skills: [
      { skill: "React Native", implies: ["React", "JavaScript/TypeScript", "mobile development"] },
      { skill: "Flutter", implies: ["Dart", "mobile development"] },
      { skill: "iOS (Swift)", implies: ["Swift", "iOS development"] },
      { skill: "Android (Kotlin)", implies: ["Kotlin", "Android development"] },
    ],
  },
  {
    category: "APIs & architecture",
    skills: [
      { skill: "REST", implies: ["API design"] },
      { skill: "GraphQL", implies: ["API design", "schema design"] },
      { skill: "gRPC", implies: ["API design", "protocol buffers"] },
      { skill: "microservices", implies: ["distributed systems", "service-to-service communication"] },
      { skill: "event-driven architecture", implies: ["asynchronous messaging"] },
    ],
  },
  {
    category: "Security",
    skills: [
      { skill: "OAuth/OIDC", implies: ["authentication/authorization"] },
      { skill: "JWT", implies: ["authentication"] },
      { skill: "TLS/SSL", implies: ["encryption in transit"] },
    ],
  },
  {
    category: "Version control",
    skills: [{ skill: "Git" }, { skill: "GitHub" }, { skill: "GitLab" }],
  },
];

function formatSkill(preset: SkillPreset): string {
  return preset.implies ? `${preset.skill}(→${preset.implies.join(",")})` : preset.skill;
}

export function formatSkillPresetsForPrompt(): string {
  return SKILL_PRESETS.map((category) => `${category.category}: ${category.skills.map(formatSkill).join("; ")}`).join(
    "\n",
  );
}
