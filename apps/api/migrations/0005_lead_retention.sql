alter table leads add column anonymized_at timestamptz;
alter table leads drop constraint leads_check1;
alter table leads add constraint leads_contact_present check (anonymized_at is not null or phone is not null or email is not null);
create index leads_retention_idx on leads(created_at) where anonymized_at is null;
