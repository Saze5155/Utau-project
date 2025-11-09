/**
 * 🔐 Script de configuration des permissions UTAU Editor (Version hybride)
 *
 * Détecte automatiquement si Directus utilise les policies ou non
 * et adapte la méthode de création des permissions
 *
 * Usage: node setup-permissions-hybrid.js
 */

const BASE_URL = "http://localhost:8055";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin";

// Couleurs pour le terminal
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Fonction pour se connecter en tant qu'admin
async function login() {
  log("\n🔐 Connexion en tant qu'admin...", "blue");

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(
      "Échec de la connexion admin. Vérifiez vos identifiants dans le script."
    );
  }

  const data = await response.json();
  log("✅ Connecté avec succès !", "green");
  return data.data.access_token;
}

// Détecter si Directus utilise le système de policies
async function detectPolicySystem(token) {
  log("\n🔍 Détection du système de permissions...", "blue");

  try {
    const response = await fetch(`${BASE_URL}/policies`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      log("✅ Système avec policies détecté (Directus >= 10.10)", "green");
      return true;
    }
  } catch (error) {
    // Endpoint n'existe pas
  }

  log("✅ Système sans policies détecté (Directus < 10.10)", "green");
  return false;
}

// Fonction pour créer le rôle "Authenticated User"
async function createRole(token) {
  log('\n👤 Création du rôle "Authenticated User"...', "blue");

  const response = await fetch(`${BASE_URL}/roles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Authenticated User",
      icon: "supervised_user_circle",
      description:
        "Utilisateurs authentifiés pouvant créer des projets musicaux",
      admin_access: false,
      app_access: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Si le rôle existe déjà, récupérer son ID
    if (error.errors?.[0]?.extensions?.code === "RECORD_NOT_UNIQUE") {
      log("⚠️  Le rôle existe déjà, récupération...", "yellow");
      const rolesResponse = await fetch(
        `${BASE_URL}/roles?filter[name][_eq]=Authenticated User`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const rolesData = await rolesResponse.json();

      if (rolesData.data && rolesData.data.length > 0) {
        log(`✅ Rôle récupéré avec l'ID: ${rolesData.data[0].id}`, "green");
        return rolesData.data[0].id;
      }
    }
    throw new Error(`Erreur création rôle: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  log(`✅ Rôle créé avec l'ID: ${data.data.id}`, "green");
  return data.data.id;
}

// Créer une policy pour le système moderne
async function createPolicy(token, roleId) {
  log("\n📋 Création de la policy...", "blue");

  const response = await fetch(`${BASE_URL}/policies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Authenticated User Policy",
      icon: "shield",
      description: "Permissions pour les utilisateurs authentifiés",
      admin_access: false,
      app_access: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();

    // Si la policy existe, la récupérer
    if (error.errors?.[0]?.extensions?.code === "RECORD_NOT_UNIQUE") {
      log("⚠️  La policy existe déjà, récupération...", "yellow");
      const policiesResponse = await fetch(
        `${BASE_URL}/policies?filter[name][_eq]=Authenticated User Policy`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const policiesData = await policiesResponse.json();

      if (policiesData.data && policiesData.data.length > 0) {
        const policyId = policiesData.data[0].id;
        log(`✅ Policy récupérée avec l'ID: ${policyId}`, "green");

        // Associer la policy au rôle si pas déjà fait
        await associatePolicyToRole(token, policyId, roleId);

        return policyId;
      }
    }

    throw new Error(`Erreur création policy: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const policyId = data.data.id;
  log(`✅ Policy créée avec l'ID: ${policyId}`, "green");

  // Associer la policy au rôle
  await associatePolicyToRole(token, policyId, roleId);

  return policyId;
}

// Associer une policy à un rôle
async function associatePolicyToRole(token, policyId, roleId) {
  log("🔗 Association de la policy au rôle...", "blue");

  const response = await fetch(`${BASE_URL}/policies/${policyId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      roles: [roleId],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    log(
      `⚠️  Association policy-rôle: ${error.errors?.[0]?.message || "Erreur"}`,
      "yellow"
    );
  } else {
    log("✅ Policy associée au rôle", "green");
  }
}

// Créer une permission (adapté selon le système)
async function createPermission(
  token,
  roleId,
  policyId,
  collection,
  action,
  permissions = {},
  fields = ["*"]
) {
  const body = {
    collection: collection,
    action: action,
    permissions: permissions,
    fields: fields,
  };

  // Ajouter policy ou role selon le système
  if (policyId) {
    body.policy = policyId;
  } else {
    body.role = roleId;
  }

  const response = await fetch(`${BASE_URL}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();

    // Ignorer les permissions déjà existantes
    if (error.errors?.[0]?.extensions?.code === "RECORD_NOT_UNIQUE") {
      return "exists";
    }

    return null;
  }

  const data = await response.json();
  return data.data.id;
}

// Configuration des permissions
async function setupPermissions(token, roleId, policyId) {
  log("\n🔧 Configuration des permissions...", "cyan");

  const permissionsConfig = [
    // === VOICEBANKS ===
    {
      collection: "voicebanks",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
        {
          action: "update",
          filter: { user_created: { _eq: "$CURRENT_USER" } },
        },
        {
          action: "delete",
          filter: { user_created: { _eq: "$CURRENT_USER" } },
        },
      ],
    },

    // === PROJECTS ===
    {
      collection: "projects",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
        {
          action: "update",
          filter: { user_created: { _eq: "$CURRENT_USER" } },
        },
        {
          action: "delete",
          filter: { user_created: { _eq: "$CURRENT_USER" } },
        },
      ],
    },

    // === NOTES ===
    {
      collection: "notes",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
        { action: "update", filter: {} },
        { action: "delete", filter: {} },
      ],
    },

    // === TAGS ===
    {
      collection: "tags",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
      ],
    },

    // === PROJECTS_TAGS ===
    {
      collection: "projects_tags",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
        { action: "update", filter: {} },
        { action: "delete", filter: {} },
      ],
    },

    // === PROJECTS_LIKES ===
    {
      collection: "projects_likes",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
        { action: "update", filter: { user_id: { _eq: "$CURRENT_USER" } } },
        { action: "delete", filter: { user_id: { _eq: "$CURRENT_USER" } } },
      ],
    },

    // === COLLABORATIONS ===
    {
      collection: "collaborations",
      permissions: [
        { action: "read", filter: { user_id: { _eq: "$CURRENT_USER" } } },
        { action: "create", filter: {} },
        { action: "update", filter: { user_id: { _eq: "$CURRENT_USER" } } },
        { action: "delete", filter: {} },
      ],
    },

    // === NOTIFICATIONS ===
    {
      collection: "notifications",
      permissions: [
        { action: "read", filter: { user_id: { _eq: "$CURRENT_USER" } } },
        {
          action: "update",
          filter: { user_id: { _eq: "$CURRENT_USER" } },
          fields: ["is_read"],
        },
        { action: "delete", filter: { user_id: { _eq: "$CURRENT_USER" } } },
      ],
    },

    // === DIRECTUS_FILES ===
    {
      collection: "directus_files",
      permissions: [
        { action: "read", filter: {} },
        { action: "create", filter: {} },
        { action: "update", filter: { uploaded_by: { _eq: "$CURRENT_USER" } } },
        { action: "delete", filter: { uploaded_by: { _eq: "$CURRENT_USER" } } },
      ],
    },

    // === DIRECTUS_USERS ===
    {
      collection: "directus_users",
      permissions: [
        {
          action: "read",
          filter: {},
          fields: ["id", "first_name", "last_name", "email", "avatar"],
        },
      ],
    },
  ];

  let successCount = 0;
  let existsCount = 0;
  let errorCount = 0;
  let totalCount = 0;

  for (const config of permissionsConfig) {
    log(`\n  📦 Collection: ${config.collection}`, "cyan");

    for (const perm of config.permissions) {
      totalCount++;
      const result = await createPermission(
        token,
        roleId,
        policyId,
        config.collection,
        perm.action,
        perm.filter,
        perm.fields || ["*"]
      );

      if (result && result !== "exists") {
        successCount++;
        log(`    ✅ ${perm.action} - Créée`, "green");
      } else if (result === "exists") {
        existsCount++;
        log(`    ℹ️  ${perm.action} - Existe déjà`, "blue");
      } else {
        errorCount++;
        log(`    ❌ ${perm.action} - Erreur`, "red");
      }

      // Petit délai
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  log(`\n📊 Résumé:`, "cyan");
  log(`   ✅ ${successCount} permissions créées`, "green");
  log(`   ℹ️  ${existsCount} permissions existantes`, "blue");
  log(`   ❌ ${errorCount} erreurs`, errorCount > 0 ? "red" : "green");
  log(`   📈 Total: ${totalCount} permissions`, "cyan");

  return { successCount, existsCount, errorCount, totalCount };
}

// Fonction principale
async function main() {
  try {
    log("\n╔═══════════════════════════════════════════════════╗", "cyan");
    log("║   🚀 Configuration des permissions UTAU Editor   ║", "cyan");
    log("║           (Version Hybride Auto-Detect)          ║", "magenta");
    log("╚═══════════════════════════════════════════════════╝", "cyan");

    // 1. Connexion
    const token = await login();

    // 2. Détecter le système de permissions
    const usePolicies = await detectPolicySystem(token);

    // 3. Créer le rôle
    const roleId = await createRole(token);

    // 4. Créer la policy si nécessaire
    let policyId = null;
    if (usePolicies) {
      policyId = await createPolicy(token, roleId);
    }

    // 5. Configurer les permissions
    const results = await setupPermissions(token, roleId, policyId);

    log("\n╔═══════════════════════════════════════════════════╗", "green");
    log("║          ✅ Configuration terminée !              ║", "green");
    log("╚═══════════════════════════════════════════════════╝", "green");

    log("\n📋 Prochaines étapes:", "cyan");
    log("1. Aller dans Directus: http://localhost:8055", "blue");
    log("2. Settings → Access Control → Roles", "blue");
    log('3. Cliquer sur "Authenticated User"', "blue");
    if (usePolicies) {
      log("4. Vérifier la policy avec les permissions", "blue");
    } else {
      log("4. Vérifier les permissions directement sur le rôle", "blue");
    }
    log("\n💡 Créer un utilisateur test:", "yellow");
    log("   User Directory → Create User", "yellow");
    log("   Email: test@example.com", "yellow");
    log("   Password: password123", "yellow");
    log("   Role: Authenticated User", "yellow");
    log("\n🎯 Tester avec Insomnia:", "yellow");
    log("   1. Login avec test@example.com", "yellow");
    log("   2. Copier l'access_token", "yellow");
    log("   3. Tester les endpoints !\n", "yellow");
  } catch (error) {
    log(`\n❌ Erreur fatale: ${error.message}`, "red");
    log("\n🔍 Vérifications:", "yellow");
    log("- Directus est démarré sur http://localhost:8055", "yellow");
    log("- Les identifiants admin sont corrects dans le script", "yellow");
    log("- Le schéma UTAU a été appliqué", "yellow");
    log("\n💡 Solution alternative:", "yellow");
    log(
      "- Configurer les permissions manuellement (voir GUIDE-PERMISSIONS-MANUEL.md)",
      "yellow"
    );
    process.exit(1);
  }
}

// Exécuter le script
main();
