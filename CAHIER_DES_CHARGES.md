# Cahier des Charges — Application de Gestion des Autorisations d'Absence
**Organisations :** Massaka SAS / Agribusiness TV
**Version :** 1.0
**Date :** 28 mai 2026
**Horizon :** Court terme — 1 à 3 mois
**Cible :** Application mobile (iOS / Android) + Application web autonome

---

## 1. Contexte

Le système actuel repose sur Google Forms + Google Sheets + Google Apps Script.
Il fonctionne mais présente des limites :
- Pas d'interface mobile native
- Pas de tableau de bord temps réel pour la RH et la Direction
- Pas de suivi de l'état d'une demande par l'employé
- Dépendance totale à Google Workspace
- Pas d'historique d'audit exploitable

L'objectif est de construire une application autonome (mobile + web) qui reproduit
et améliore le système existant, avec une base de données propre et une interface
adaptée à chaque rôle.

---

## 2. Utilisateurs et rôles

| Rôle | Accès | Responsabilités |
|---|---|---|
| **Employé** | Mobile + Web | Soumettre une demande, suivre son état |
| **Supérieur hiérarchique** | Mobile + Web | Approuver ou rejeter les demandes de son équipe |
| **Responsable RH** | Web (prioritaire) + Mobile | Superviser toutes les demandes, gérer les paramètres |
| **Direction / Présidence** | Mobile + Web | Validation finale, vue d'ensemble multi-organisations |
| **Administrateur système** | Web uniquement | Gérer les utilisateurs, les services, les workflows |

---

## 3. Fonctionnalités par rôle

### 3.1 Employé

- [ ] Créer une demande d'autorisation d'absence
  - Type de permission (Permission ordinaire / exceptionnelle / congé)
  - Dates, heures, motif
  - Soumission avec accusé de réception immédiat
- [ ] Suivre l'état de sa demande en temps réel
  - Statut : En attente / En cours / Approuvé / Rejeté
  - Voir à quel niveau la demande est bloquée
- [ ] Recevoir une notification push à chaque changement de statut
- [ ] Télécharger le document officiel (PDF) une fois approuvé
- [ ] Consulter l'historique de ses demandes passées
- [ ] Voir son solde de jours de congé restants (si géré)

### 3.2 Supérieur hiérarchique

- [ ] Recevoir une notification push à chaque nouvelle demande à valider
- [ ] Voir la liste des demandes en attente de sa validation
- [ ] Approuver ou rejeter une demande depuis l'application
  - Motif de rejet obligatoire
- [ ] Consulter l'historique des demandes de son équipe
- [ ] Déléguer temporairement ses droits de validation (ex : en cas d'absence)

### 3.3 Responsable RH

- [ ] Tableau de bord global
  - Demandes en cours / approuvées / rejetées ce mois
  - Demandes bloquées depuis plus de N jours
  - Statistiques par service et par organisation
- [ ] Valider ou rejeter les demandes au niveau RH
- [ ] Renvoyer manuellement un email / notification de validation
- [ ] Reprendre un traitement échoué
- [ ] Exporter les demandes du mois en PDF ou Excel
- [ ] Gérer les paramètres :
  - Ajouter / modifier les services
  - Assigner les supérieurs hiérarchiques par service
  - Configurer les circuits de validation par service
  - Mettre à jour les jours fériés

### 3.4 Direction / Présidence

- [ ] Recevoir une notification push pour les validations finales
- [ ] Approuver ou rejeter les demandes au niveau Présidence
- [ ] Vue d'ensemble multi-organisations (Massaka SAS + Agribusiness TV)
- [ ] Rapport mensuel automatique reçu par email

### 3.5 Administrateur système

- [ ] Gérer les comptes utilisateurs (créer, désactiver, changer de rôle)
- [ ] Gérer les organisations (multi-entités)
- [ ] Configurer les thèmes visuels par organisation
- [ ] Consulter les logs système

---

## 4. Circuits de validation

Les circuits existants doivent être reproduits à l'identique :

| Circuit | Flux |
|---|---|
| `SUP_RH_PRES` | Supérieur → RH → Présidence (circuit complet) |
| `RH_PRES` | RH → Présidence (pas de supérieur) |
| `PRES` | Présidence uniquement |
| `PRES_RH` | Présidence → RH (RH est validateur final) |

**Règle métier clé :** Toute demande soumise avec moins de 3 jours ouvrables
de préavis est rejetée automatiquement. Les jours fériés sont exclus du calcul.

---

## 5. Notifications

| Événement | Employé | Supérieur | RH | Présidence |
|---|---|---|---|---|
| Nouvelle demande soumise | ✅ Accusé de réception | ✅ Si 1er validateur | — | — |
| Approbation intermédiaire | ❌ | — | ✅ Si niveau RH | ✅ Si niveau Pres |
| Rejet à n'importe quel niveau | ✅ Avec motif | — | ✅ | — |
| Approbation finale | ✅ Avec PDF | — | ✅ | — |
| Relance (sans réponse depuis N jours) | — | ✅ | ✅ | ✅ |
| Escalade (2 relances sans réponse) | — | — | ✅ Alerte admin | — |

Canaux : notification push (mobile) + email HTML.

---

## 6. Exigences techniques

### 6.1 Application mobile
- iOS et Android
- Framework recommandé : **Flutter** ou **React Native**
- Notifications push : Firebase Cloud Messaging (FCM)
- Mode hors-ligne : consultation des demandes en cache

### 6.2 Application web
- Interface responsive (desktop prioritaire pour RH et Admin)
- Framework recommandé : **Next.js** (React) ou **Vue.js**
- Accessible depuis tout navigateur moderne sans installation

### 6.3 Backend / API
- API REST ou GraphQL
- Authentification : JWT + refresh token
- Gestion des rôles côté serveur (RBAC)
- Framework recommandé : **Node.js (Express / Fastify)** ou **Django**

### 6.4 Base de données
- **PostgreSQL** (relationnel — adapté aux workflows et aux audits)
- Schéma principal : Utilisateurs, Services, Demandes, Décisions, Tokens, Logs

### 6.5 Stockage fichiers
- Documents PDF générés et stockés sur **AWS S3** ou **Google Cloud Storage**

### 6.6 Sécurité
- HTTPS obligatoire
- Tokens de validation à usage unique (même logique que l'actuel)
- Aucun mot de passe stocké en clair (bcrypt)
- Logs d'audit immuables pour chaque décision

---

## 7. Ce qui doit être migré depuis le système actuel

| Élément actuel (GAS) | Équivalent dans la nouvelle app |
|---|---|
| Google Sheet colonnes A–P | Formulaire de demande |
| Colonnes R–U (avis validateurs) | Table `decisions` en base |
| Colonnes V–AD (tokens, statuts) | Table `demandes` + `tokens` |
| `Config.gs` SERVICE_SUP_MAP | Interface Admin → Gestion services |
| `Config.gs` PRESIDENCE_MAP | Interface Admin → Thèmes organisations |
| `Notifications.gs` emails HTML | Service de notification (email + push) |
| `DriveManager.gs` PDF | Service de génération PDF |
| `Relances.gs` relances auto | Tâche planifiée (cron) côté serveur |
| `WebApp.gs` page validation | Interface validateur mobile + web |

---

## 8. Hors scope (version 1)

- Gestion des congés payés avec solde et compteur
- Intégration avec un logiciel de paie
- Signature électronique légale (DocuSign, etc.)
- Application desktop
- Support multilingue (autre que français)

---

## 9. Priorités de développement (1-3 mois)

### Mois 1 — Fondations
- [ ] Authentification et gestion des rôles
- [ ] Soumission de demande (employé)
- [ ] Circuit de validation complet (tous les niveaux)
- [ ] Notifications email

### Mois 2 — Interface et notifications
- [ ] Application mobile (iOS + Android)
- [ ] Notifications push
- [ ] Tableau de bord RH
- [ ] Génération PDF et téléchargement

### Mois 3 — Finalisation
- [ ] Interface Admin (gestion services, utilisateurs, workflows)
- [ ] Relances automatiques et escalade
- [ ] Export Excel / PDF mensuel
- [ ] Tests, corrections, déploiement en production

---

## 10. Critères de succès

- Un employé peut soumettre une demande en moins de 2 minutes
- Un validateur peut approuver depuis son téléphone en moins de 30 secondes
- La RH a une vue complète de toutes les demandes en temps réel
- Zéro perte de demande (traçabilité complète)
- Le système fonctionne pour les deux organisations (Massaka SAS + Agribusiness TV)
  avec thèmes visuels distincts

---

*Document généré le 28 mai 2026 — Système d'autorisation d'absence Massaka*
