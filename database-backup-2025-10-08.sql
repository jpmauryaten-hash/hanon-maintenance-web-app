-- PostgreSQL Database Backup
-- Generated on: 2025-10-08T15:38:57.203Z
-- Database: Breakdown Tracker

-- Disable triggers during restore
SET session_replication_role = replica;

-- Clear existing data (in reverse order due to foreign keys)
TRUNCATE TABLE breakdowns CASCADE;
TRUNCATE TABLE machines CASCADE;
TRUNCATE TABLE problem_types CASCADE;
TRUNCATE TABLE sub_lines CASCADE;
TRUNCATE TABLE lines CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE users CASCADE;


-- Users
INSERT INTO users (id, username, password, name, email, role) VALUES ('0c212865-260d-4753-8a2e-f3609ef3b515', 'admin', '$2b$10$ESRNQUv5hCBWH4SoFwamUOuNLB419z8FcJox5PGRWe0h9ItNicRFW', 'Admin User', 'admin@example.com', 'Admin');
INSERT INTO users (id, username, password, name, email, role) VALUES ('fc930539-3241-4884-973c-25d223e29336', 'engineer', '$2b$10$LQHdauYIaUFZR/ey3pK.Q.bGHo2AeNIE6TgZR4TiuovEQtXRDTldW', 'John Doe', 'engineer@example.com', 'Engineer');

-- Employees
INSERT INTO employees (id, name, role, department) VALUES ('dac6b997-7aa4-46e2-a794-094caf5cbd7a', 'ADITYA', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('14cb195e-209f-463c-a8df-9d22e606e51f', 'AKHIL', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('3d03efa7-9b80-4827-8301-7b3f4a81268f', 'ANUBHAV', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('00de2af4-9f6c-4b57-8694-9869a86e6405', 'ASHUTOSH TRPATHI', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('0a7a3984-cd51-4ca7-853b-c560168e9c3f', 'ASLAM KHAN', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('5b7026f0-bf8c-4b0f-9aa6-3b6eff7e0245', 'DALIP KUMAR', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('b6e76b2f-43bd-4c08-a654-6457d542fe5c', 'DINESH TYAGI', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('ce322820-089f-4b2a-a3e8-4967123c5d30', 'MUKESH SHARMA', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('6b7336c1-e4e4-4b57-bf10-00c2650d1b12', 'NARENDER KUMAR', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('d2030297-bf91-4964-a4b3-4851963c853c', 'RADHE SHAYM', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('0d93168f-8cb6-46e5-98a3-8c10ff15adcf', 'SANTOSH SHARMA', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('26081fef-ca31-4e2d-9947-936ab08d1673', 'SATYA PRAKASH', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('e14f8bc5-c40d-4d28-b6c2-6535549691f0', 'ASHUTOSH TIRPATHI', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('a48cefea-1341-46ac-8292-59ed12fc83af', 'BALAM  DAS', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('e981bf2f-5757-4cc3-b8ce-cf1f1c08f9d5', 'HARSH', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('731c9cbd-0358-4013-969b-b16407c3307b', 'RADHAY SHYAM', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('f4b04194-5601-4d77-85a3-a10414e7bbdf', 'Santosh Sharma', 'Technician', 'Maintenance');
INSERT INTO employees (id, name, role, department) VALUES ('4288fdfe-d837-4d09-981e-83095421f284', 'Satya Prakash', 'Technician', 'Maintenance');

-- Lines
INSERT INTO lines (id, name, description) VALUES ('ab3bef9b-e911-486a-8341-1344a677301a', 'FRONT LINE', 'FRONT LINE production line');
INSERT INTO lines (id, name, description) VALUES ('ef08b6f6-a8aa-45fe-84e7-06e78da67848', 'FT & MANIFOLD  LINE', 'FT & MANIFOLD  LINE production line');
INSERT INTO lines (id, name, description) VALUES ('d0d13280-f076-4960-ba8e-c7d0ee755491', 'IMM & PRESS SHOP', 'IMM & PRESS SHOP production line');
INSERT INTO lines (id, name, description) VALUES ('77d59c5e-1451-4f4e-901b-48df020d30d3', 'FINAL LINE', 'FINAL LINE production line');

-- Sub Lines
INSERT INTO sub_lines (id, name, line_id) VALUES ('3401c121-a70d-4235-ac0c-4207486ef1e8', 'AC LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('a3c6d0a1-69b9-480f-b22b-cf081e150f83', 'CAB LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('3312c1e3-6d6f-4135-8823-9284a0f10fa9', 'CAC LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('5201f7ed-a079-4bd2-b85f-f71caa8833d2', 'CONDENCER LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('1dea3e18-b659-4009-bb93-213c59a32a19', 'ECM LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('8a3430b1-5ff9-4027-b9a1-fb77098c634b', 'GAMA LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('54a42c8f-df60-448d-ab76-b59b2b881292', 'HEADER PRESS', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('686530a6-71d8-41eb-a3fa-3eeb67c12585', 'IMM', 'ab3bef9b-e911-486a-8341-1344a677301a');
INSERT INTO sub_lines (id, name, line_id) VALUES ('58ee9fe1-99cd-4528-9c54-4936fddecbb5', 'RADIATOR LINE', 'ab3bef9b-e911-486a-8341-1344a677301a');

-- Machines
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('83581931-4a27-49b2-a5d1-b7d98fd35b27', 'CORE BUILDER -5 MATRIX (RAD)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('73a6a1a8-4665-44fb-9d7a-a6f84778e9be', 'CORE BUILDER-1 (CAC)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('b82e3011-ea07-4daf-badb-48d1cf8f7d94', 'CORE BUILDER-1 MATRIX (COND)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('e68abd9b-58fa-40cf-90c1-4be25d918425', 'CORE BUILDER-1 MATRIX GAMMA (CAC)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('a1b78258-ca0e-4df9-9caf-cd4f2d03aaa4', 'CORE BUILDER-2 MATRIX (COND)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('645f7fc1-5f1a-4189-9b97-a0afc3da1770', 'CORE BUILDER-2 MATRIX GAMMA (CAC)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('b755ad16-2797-4e1a-a044-a465f28db6bb', 'CORE BUILDER-4 MATRIX (COND)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('8a4b9bda-6922-43a6-9726-49f16bed2abb', 'CORE BUILDER-6 MATRIX (RAD)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('9f2bc10e-d82a-49a6-b8b1-26316bd90658', 'DRY LEAK TEST & PRINTER (GAMMA )', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('e47eceb3-21f1-4f2a-aa5b-f70d129f3fb9', 'FAN BALANCING-1 (ECM-A)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('a31aaa5e-7164-4c67-a6cd-629a3a02bc52', 'FIN MILL -2', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('fd36d7f4-3750-4c71-8d1b-b9ce525d322e', 'FIN MILL- 5 (MATRIX)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('74ac19dd-4b6e-4571-baee-beed294bc57e', 'FIN MILL-10 (AUTO FIN INSERTION)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('91ebd38a-7520-4451-8c68-3505309776b3', 'FIN MILL-8 (MATRIX)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('da418fc8-2ced-4686-97a5-60da1dbd3b88', 'HEADER PRESS-2', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('7057cb43-0dd2-4507-8476-3a00c7145db0', 'HELIUM LEAK DETECTOR-2 (MSIL)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('6e4e7d34-19f1-4994-a215-4cbb8bdc8fa6', 'MOULDING -1', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('9a24c5c5-3b9e-4e10-8dc3-69650f87ba0e', 'PIPE ASSY-2 (GAMMA)', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('644d0d40-0ed8-4962-8d07-6eaf1a2977f4', 'PRESSURE SWITCH ASSEMBLY', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');
INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES ('2c98dbd3-c367-4641-a51a-cfcc0f74ea1f', 'WLT- AC LINE', 'ab3bef9b-e911-486a-8341-1344a677301a', NULL, 'Production Machine');

-- Problem Types
INSERT INTO problem_types (id, name, description) VALUES ('a101751d-ebc2-4d97-9f4f-825daedba986', 'B/D', 'B/D');
INSERT INTO problem_types (id, name, description) VALUES ('cce1e53b-e99a-4ba6-914d-140a44f195cc', 'SAFETY /OTHER', 'SAFETY /OTHER');
INSERT INTO problem_types (id, name, description) VALUES ('b5cb1093-1062-4de5-bf96-42ef50aaac8d', 'P.M.', 'P.M.');
INSERT INTO problem_types (id, name, description) VALUES ('716b556d-7c89-41c3-b863-2af523158345', 'PREDECTIVE MAINTENANCE', 'PREDECTIVE MAINTENANCE');
INSERT INTO problem_types (id, name, description) VALUES ('7a0016fc-ab71-4b62-a7c6-8a438feaaf63', 'OVERHAULING', 'OVERHAULING');
INSERT INTO problem_types (id, name, description) VALUES ('07072f1e-4881-41b5-a3a5-346eaff82b33', 'PLAN ACTIVITY', 'PLAN ACTIVITY');
INSERT INTO problem_types (id, name, description) VALUES ('43f23ef6-cbc1-404a-a5eb-88e437842bca', 'IMPROVEMENT', 'IMPROVEMENT');
INSERT INTO problem_types (id, name, description) VALUES ('0c017494-6fd8-4824-88ba-053118a75137', 'TPM ACTIVITY', 'TPM ACTIVITY');
INSERT INTO problem_types (id, name, description) VALUES ('dea42304-f965-400d-9e49-6e1a2ccf0188', 'GI ACTIVITY', 'GI ACTIVITY');

-- Breakdowns
INSERT INTO breakdowns (id, date, shift, line_id, sub_line_id, machine_id, problem_type_id, problem_description, start_time, end_time, total_time, attendees, closer, status, priority, capa_required, capa_data, five_why_analysis, root_causes, preventive_actions, prepared_by, approved_by, target_date, completion_date, evidence_before, evidence_after) VALUES ('f8e62eb4-0b75-4458-83be-a0c682ddacb5', '2025-10-08', 'A', 'ab3bef9b-e911-486a-8341-1344a677301a', '3401c121-a70d-4235-ac0c-4207486ef1e8', '83581931-4a27-49b2-a5d1-b7d98fd35b27', '716b556d-7c89-41c3-b863-2af523158345', NULL, '07:00', NULL, NULL, NULL, NULL, 'closed', 'High', 'no', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO breakdowns (id, date, shift, line_id, sub_line_id, machine_id, problem_type_id, problem_description, start_time, end_time, total_time, attendees, closer, status, priority, capa_required, capa_data, five_why_analysis, root_causes, preventive_actions, prepared_by, approved_by, target_date, completion_date, evidence_before, evidence_after) VALUES ('2c2c6ddc-da35-4cad-a09f-6e236b47f9d3', '2025-10-08', 'A', 'd0d13280-f076-4960-ba8e-c7d0ee755491', 'a3c6d0a1-69b9-480f-b22b-cf081e150f83', 'b82e3011-ea07-4daf-badb-48d1cf8f7d94', '7a0016fc-ab71-4b62-a7c6-8a438feaaf63', NULL, '08:47', NULL, NULL, NULL, NULL, 'open', 'Medium', 'no', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO breakdowns (id, date, shift, line_id, sub_line_id, machine_id, problem_type_id, problem_description, start_time, end_time, total_time, attendees, closer, status, priority, capa_required, capa_data, five_why_analysis, root_causes, preventive_actions, prepared_by, approved_by, target_date, completion_date, evidence_before, evidence_after) VALUES ('72e85096-8e10-4dc0-b13f-347b59f1cf1b', '2025-10-08', 'A', 'ab3bef9b-e911-486a-8341-1344a677301a', 'a3c6d0a1-69b9-480f-b22b-cf081e150f83', '73a6a1a8-4665-44fb-9d7a-a6f84778e9be', 'cce1e53b-e99a-4ba6-914d-140a44f195cc', NULL, '06:41', NULL, NULL, NULL, NULL, 'open', 'High', 'yes', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Backup completed successfully
