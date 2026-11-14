create function private.valid_ean(code text) returns boolean language plpgsql immutable strict set search_path='' as $$
declare total integer:=0; n integer:=length(code); i integer; begin
  if code !~ '^(\d{8}|\d{13})$' then return false; end if;
  for i in 1..n-1 loop
    total:=total+substring(code,i,1)::integer*case when mod(n-i,2)=1 then 3 else 1 end;
  end loop;
  return mod(10-mod(total,10),10)=substring(code,n,1)::integer;
end $$;
revoke all on function private.valid_ean(text) from public;
grant execute on function private.valid_ean(text) to authenticated;
alter table public.specific_products add constraint valid_barcode_checksum check(barcode is null or private.valid_ean(barcode));
