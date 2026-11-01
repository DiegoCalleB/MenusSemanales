-- Utilidades compartidas por los tests SQL. Se incluyen con \i dentro de la transacción.
create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  execute 'set local role ' || case when p_uid is null then 'anon' else 'authenticated' end;
end $$;

create function pg_temp.fin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', true); end $$;

create function pg_temp.cuenta(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || p_sql || ') t' into n; return n; end $$;

-- Ejecuta p_sql y exige que falle con el SQLSTATE indicado.
create function pg_temp.falla(p_nombre text, p_sql text, p_sqlstate text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then raise notice 'OK    %', p_nombre; return; end if;
    raise exception 'FALLO % : esperaba SQLSTATE %, llegó % (%)', p_nombre, p_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'FALLO % : debía fallar y no falló', p_nombre;
end $$;

create function pg_temp.igual(p_nombre text, p_real bigint, p_esperado bigint) returns void language plpgsql as $$
begin
  if p_real is distinct from p_esperado then
    raise exception 'FALLO % : esperaba %, obtuvo %', p_nombre, p_esperado, p_real;
  end if;
  raise notice 'OK    %', p_nombre;
end $$;
