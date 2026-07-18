// Source-of-truth legal content (Azerbaijani), transcribed verbatim from the original design's
// legalDocs(). Kept separate from lib/i18n/locales/ so 3 long documents x 2 languages don't bloat
// the type every unrelated UI-string edit in az.ts type-checks against.

const M = 'support@peeky.az';

export const az = {
  updated: 'Son yenilənmə: 14 iyul 2026',
  privacy: {
    title: 'Məxfilik Siyasəti',
    sections: [
      ['1. Ümumi məlumat', ['PeekMatch, Peeky tərəfindən təqdim edilən AI əsaslı CV və vakansiya uyğunluq xidmətidir.', 'Bu Məxfilik Siyasəti PeekMatch platformasından istifadə etdiyiniz zaman məlumatlarınızın necə toplandığını, istifadə edildiyini, saxlanıldığını və silindiyini izah edir.', 'Məxfiliklə bağlı bütün suallar üçün: ' + M]],
      ['2. Hansı məlumatları toplayırıq?', ['Platformadan istifadə etdikdə aşağıdakı məlumatlar emal oluna bilər:', '• yüklədiyiniz CV və CV-də olan məlumatlar;', '• vakansiyanın URL-si və ya daxil etdiyiniz vakansiya mətni;', '• seçdiyiniz nəticə dili;', '• uyğunluq nəticələri və yaradılmış sənədlər;', '• anonim sessiya və texniki təhlükəsizlik məlumatları;', '• seçilmiş paket, sifariş məbləği və ödəniş statusu;', '• bizə göndərdiyiniz dəstək müraciətləri.', 'PeekMatch tam kart nömrəsini, CVV kodunu və kartın istifadə müddətini görmür və saxlamır. Kart məlumatları birbaşa ödəniş təminatçısı tərəfindən emal olunur.']],
      ['3. Məlumatlardan necə istifadə edirik?', ['Məlumatlarınız yalnız aşağıdakı məqsədlərlə istifadə edilir:', '• CV və vakansiyanı müqayisə etmək;', '• əsas tələbləri və kritik boşluqları müəyyənləşdirmək;', '• uyğunluq göstəricilərini hesablamaq;', '• güclü tərəflər və müraciət tövsiyəsi hazırlamaq;', '• uyğunlaşdırılmış CV, cover letter və müsahibə materialları yaratmaq;', '• ödənişi təsdiqləmək və alınmış paketi aktivləşdirmək;', '• platformanın təhlükəsizliyini qorumaq;', '• texniki xətaları və sui-istifadə hallarını müəyyənləşdirmək;', '• istifadəçi müraciətlərinə cavab vermək.', 'PeekMatch fərdi məlumatlarınızı satmır və onları reklam məqsədilə istifadə etmir.']],
      ['4. AI analizi', ['PeekMatch CV və vakansiyanın müqayisəsi üçün AI və qayda əsaslı hesablama sistemlərindən istifadə edir.', 'Namizədin uyğunluğu hesablanarkən ad, fotoşəkil, yaş, cins, ailə vəziyyəti, dini baxışlar və digər qorunan şəxsi xüsusiyyətlər nəzərə alınmamalıdır.', 'Platforma yalnız CV-də olan və ya istifadəçinin təsdiqlədiyi məlumatlardan istifadə etməyə çalışır. CV-də olmayan təcrübə, sertifikat və ya bacarıq bilərəkdən yaradılmamalıdır.', '"HR müsahibəsinə dəvət almaq ehtimalı" yalnız təxmini screening göstəricisidir və işə qəbul zəmanəti deyil.']],
      ['5. Məlumatların paylaşılması', ['Məlumatlar yalnız xidmətin göstərilməsi üçün zəruri olduqda aşağıdakı təminatçı kateqoriyaları ilə emal oluna bilər:', '• bulud və məlumat saxlama təminatçıları;', '• AI xidmət təminatçıları;', '• veb-hostinq və təhlükəsizlik xidmətləri;', '• ödəniş təminatçıları;', '• qanuni tələb olduqda dövlət orqanları.', 'CV və analiz nəticələri digər istifadəçilər üçün açıq deyil və ictimai link vasitəsilə yayımlanmır.']],
      ['6. Saxlanma və silinmə', ['CV, vakansiya mətni, analiz nəticələri və yaradılmış sənədlər analiz yaradıldıqdan sonra maksimum 24 saat ərzində avtomatik silinir.', 'İstifadəçi "Məlumatlarımı sil" funksiyası vasitəsilə məlumatlarını daha əvvəl də silə bilər.', 'Qanunla tələb olunan minimal əməliyyat qeydləri CV məzmunundan ayrı şəkildə daha uzun müddət saxlanıla bilər.']],
      ['7. Hüquqlarınız', ['Tətbiq olunan qanunvericiliyə uyğun olaraq siz:', '• məlumatlarınız haqqında məlumat almaq;', '• məlumatlara çıxış tələb etmək;', '• yanlış məlumatların düzəldilməsini istəmək;', '• məlumatların silinməsini tələb etmək;', '• razılığınızı geri götürmək;', '• emala etiraz etmək;', '• AI nəticəsi ilə bağlı izah tələb etmək hüququna malik ola bilərsiniz.', 'Bu hüquqlardan istifadə etmək üçün ' + M + ' ünvanına müraciət edin.']],
      ['8. Dəyişikliklər', ['Bu siyasət məhsul, texnologiya və ya hüquqi tələblər dəyişdikdə yenilənə bilər. Əhəmiyyətli dəyişikliklər platformada göstəriləcək.']],
    ] as [string, string[]][],
  },
  terms: {
    title: 'İstifadə Şərtləri',
    sections: [
      ['1. Şərtlərin qəbulu', ['PeekMatch, Peeky tərəfindən təqdim olunan AI əsaslı karyera xidmətidir.', 'PeekMatch-dən istifadə etməklə bu İstifadə Şərtlərini və Məxfilik Siyasətini qəbul etmiş olursunuz.', 'Suallar üçün: ' + M]],
      ['2. Xidmətin təsviri', ['PeekMatch aşağıdakı xidmətləri təqdim edə bilər:', '• CV və vakansiya uyğunluğunun analizi;', '• namizədin uyğunluq göstəricisi;', '• əsas tələblərin müqayisəsi və kritik boşluqlar;', '• güclü tərəflər və müraciət tövsiyəsi;', '• ətraflı uyğunluq hesabatı;', '• vakansiyaya uyğunlaşdırılmış CV və cover letter;', '• müsahibə hazırlığı materialları;', '• PDF və DOCX sənədləri.', 'Bəzi funksiyalar ödənişsiz, bəzi funksiyalar isə ödənişlidir.']],
      ['3. AI nəticələrinin məhdudiyyətləri', ['PeekMatch-in təqdim etdiyi nəticələr AI əsaslı məlumat və tövsiyələrdir.', 'Platforma:', '• müsahibəyə dəvət alacağınıza zəmanət vermir;', '• iş təklifi alacağınıza zəmanət vermir;', '• işəgötürənin real qərarını əvvəlcədən müəyyən etmir;', '• recruiter və ya rəsmi işə qəbul orqanı kimi fəaliyyət göstərmir.', 'Hazırlanmış sənədləri işəgötürənə göndərməzdən əvvəl yoxlamaq istifadəçinin məsuliyyətidir.']],
      ['4. İstifadəçinin məsuliyyəti', ['Platformaya yüklədiyiniz məlumatların düzgünlüyünə görə siz məsuliyyət daşıyırsınız.', 'İstifadəçi:', '• saxta iş təcrübəsi təqdim etməməli;', '• mövcud olmayan bacarıq və sertifikat əlavə etməməli;', '• üçüncü şəxslərin məlumatlarını icazəsiz istifadə etməməli;', '• yaradılmış sənədləri göndərməzdən əvvəl yoxlamalıdır.']],
      ['5. Ödənişlər', ['Ödənişli paketlər birdəfəlik xidmətlərdir və avtomatik abunə yaratmır.', 'Ödənişli funksiya yalnız ödəniş təminatçısı əməliyyatı təsdiqlədikdə və ödəniş server tərəfində yoxlanıldıqda aktivləşdirilir.', 'Peeky istifadəçinin tam kart məlumatlarını saxlamır.']],
      ['6. Geri ödəniş', ['Aşağıdakı hallarda geri ödəniş nəzərdən keçirilə bilər:', '• eyni sifariş üçün təkrar ödəniş tutulduqda;', '• ödəniş tamamlandığı halda paket aktivləşdirilmədikdə;', '• texniki xəta səbəbindən ödənişli material yaradılmadıqda;', '• fayl texniki olaraq istifadəyə yararsız olduqda.', 'Uyğunluq faizinin gözləniləndən aşağı olması özlüyündə geri ödənişə zəmanət vermir.', 'Geri ödəniş müraciətləri: ' + M]],
      ['7. Qadağan olunan istifadə', ['Aşağıdakılar qadağandır:', '• başqasının CV-sini icazəsiz yükləmək;', '• saxta sənəd və ya iş təcrübəsi yaratmaq;', '• platformadan ayrı-seçkilik məqsədilə istifadə etmək;', '• ödəniş və təhlükəsizlik mexanizmlərini keçmək;', '• icazəsiz bot, scraping və avtomatlaşdırma;', '• zərərli fayl və ya kod yükləmək.']],
      ['8. Əqli mülkiyyət', ['İstifadəçinin yüklədiyi CV və şəxsi məlumatlar istifadəçiyə məxsusdur.', 'Platformanın proqram təminatı, dizaynı, loqosu, brend elementləri və analitik metodları Peeky-yə məxsusdur.']],
      ['9. Xidmətin mövcudluğu və məsuliyyət', ['Peeky platformanın hər zaman fasiləsiz və xətasız işləyəcəyinə zəmanət vermir.', 'Qanunla icazə verilən həddə Peeky işəgötürənin qərarına, müsahibəyə dəvət alınmamasına və istifadəçinin yoxlamadan göndərdiyi yanlış məlumata görə məsuliyyət daşımır.']],
      ['10. Tətbiq olunan hüquq', ['Qanunla başqa cür tələb edilmədiyi halda, bu şərtlər Azərbaycan Respublikasının qanunvericiliyinə uyğun tənzimlənir.']],
    ] as [string, string[]][],
  },
  deletion: {
    title: 'Məlumatların Silinməsi',
    sections: [
      ['Avtomatik silinmə', ['Aşağıdakı məlumatlar analiz yaradıldıqdan sonra maksimum 24 saat ərzində avtomatik silinir:', '• orijinal CV faylı və çıxarılmış mətn;', '• vakansiyanın URL-si və mətni;', '• uyğunluq analizi, güclü tərəflər və kritik boşluqlar;', '• uyğunlaşdırılmış CV və cover letter;', '• müsahibə hazırlığı materialları;', '• yaradılmış PDF və DOCX faylları.']],
      ['Məlumatları dərhal silmək', ['Nəticə səhifəsindəki "Məlumatlarımı sil" düyməsini seçərək silinməni dərhal başlada bilərsiniz.', 'Silinmə təsdiqləndikdən sonra:', '• analiz səhifəsi artıq açılmayacaq;', '• sənədlərin yükləmə linkləri işləməyəcək;', '• silinmiş CV və nəticələri bərpa etmək mümkün olmayacaq.']],
      ['E-poçtla silinmə müraciəti', ['Nəticə səhifəsinə çıxışınız yoxdursa, ' + M + ' ünvanına müraciət edə bilərsiniz.', 'E-poçtla tam kart nömrəsi, CVV kodu və şəxsiyyət vəsiqəsinin tam surətini göndərməyin.']],
      ['Silinməyən minimal qeydlər', ['Vergi, mühasibat, chargeback və fırıldaqçılığın qarşısının alınması üçün bəzi minimal ödəniş qeydləri qanunla tələb olunan müddət ərzində saxlanıla bilər.', 'Bu qeydlər mümkün olduqda CV və analiz məzmunundan ayrı saxlanılır.']],
      ['Əlaqə', ['Məlumatların silinməsi və məxfiliklə bağlı bütün müraciətlər üçün: ' + M]],
    ] as [string, string[]][],
  },
};

export type LegalDoc = { title: string; sections: [string, string[]][] };
export type LegalContent = { updated: string; privacy: LegalDoc; terms: LegalDoc; deletion: LegalDoc };
